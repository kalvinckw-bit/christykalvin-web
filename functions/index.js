/**
 * ChristyKalvin 轉賣商城 (shopping.html) - 後台雲端函式
 *
 * importProduct: 給一個商品來源連結 (例如 Takashimaya Online、Mercari、BASE 等)，
 * 伺服器端抓取該頁面，解析 og:meta / JSON-LD 商品資料，把照片下載搬到自己的
 * Cloud Storage bucket（避免原網站下架後圖片失效），有設定 GEMINI_API_KEY 的話
 * 再呼叫 Gemini 把原文標題/描述潤飾翻譯成繁體中文小賣家口吻，同時生成英文版本。
 *
 * uploadPhoto / deletePhoto: 後台手動上傳、刪除商品照片。
 *
 * 匯入結果一律先寫成 status:"draft"，需要後台人工核對後才會發布 (published)，
 * 沿用本專案 myproperty 後台「未審核 / 已審核」的人工複核習慣。
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { Storage } = require("@google-cloud/storage");
const { extractFromHtml } = require("./extract");

initializeApp();

// firebase-admin 的 storage 包裝只提供 bucket()，沒有 createBucket()，
// 所以建立 bucket 這件事改用底層的 @google-cloud/storage 客戶端直接處理。
const gcs = new Storage();

// 商品照片存放的 Cloud Storage bucket。
// 這個專案沒有開通 Firebase Storage，所以改由函式自己建立並維護一個公開讀取的
// bucket（首次使用時自動建立），照片一律用 https://storage.googleapis.com/... 直連。
const PHOTO_BUCKET = "christykalvin-shop-photos";
const PHOTO_BUCKET_LOCATION = "ASIA-NORTHEAST1";

// AI 潤飾/翻譯用的 Gemini API Key：從執行環境讀取（functions/.env，不可 commit 進 git）。
// 尚未設定時，匯入功能照常運作，只是不做翻譯潤飾（匯入原文草稿讓人工補）。
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function db() {
  return getFirestore();
}

function bucket() {
  return gcs.bucket(PHOTO_BUCKET);
}

/**
 * 確保照片 bucket 存在且可公開讀取（冪等，重複呼叫安全）。
 * 第一次呼叫時建立 bucket 並授予 allUsers 讀取權限，之後直接沿用。
 */
let bucketReady = false;
async function ensurePhotoBucket() {
  if (bucketReady) return { created: false, warning: "" };
  const b = bucket();
  const [exists] = await b.exists();
  if (exists) {
    bucketReady = true;
    return { created: false, warning: "" };
  }
  await gcs.createBucket(PHOTO_BUCKET, {
    location: PHOTO_BUCKET_LOCATION,
    iamConfiguration: { uniformBucketLevelAccess: { enabled: true } },
  });
  let warning = "";
  try {
    const [policy] = await b.iam.getPolicy({ requestedPolicyVersion: 3 });
    policy.bindings = policy.bindings || [];
    policy.bindings.push({ role: "roles/storage.objectViewer", members: ["allUsers"] });
    await b.iam.setPolicy(policy);
  } catch (err) {
    warning = `照片 bucket 已建立，但設定公開讀取失敗（照片可能無法在前台顯示）：${err.message}`;
  }
  bucketReady = true;
  return { created: true, warning };
}

function photoPublicUrl(filePath) {
  return `https://storage.googleapis.com/${PHOTO_BUCKET}/${filePath
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

async function fetchSourceHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept-Language": "ja,zh-TW;q=0.8,zh;q=0.7,en;q=0.5",
    },
  });
  if (!res.ok) throw new Error(`來源網站回應 HTTP ${res.status}`);
  return res.text();
}

async function downloadImagesToStorage(productId, imageUrls) {
  const b = bucket();
  const uploaded = [];
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const res = await fetch(imageUrls[i], { headers: { "User-Agent": BROWSER_UA } });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") || "image/jpeg";
      if (!contentType.startsWith("image/")) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      // 小於 3KB 多半是追蹤像素或佔位圖，不收
      if (buf.length < 3072) continue;
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const filePath = `products/${productId}/${i}.${ext}`;
      await b.file(filePath).save(buf, { metadata: { contentType } });
      uploaded.push(photoPublicUrl(filePath));
    } catch (_) {
      // 單張圖失敗不影響其他圖片，略過即可
    }
  }
  return uploaded;
}

const GEMINI_MODEL = "gemini-2.0-flash";

async function refineWithGemini(apiKey, title, description) {
  const prompt = `以下是一個日本網店商品頁面抓到的原始標題與描述，你要幫忙做「代購轉賣」上架用的文案整理，同時做一份英文版給國際買家看。請只回傳純 JSON，不要加任何說明文字：
{"title_zh":"","description_zh":"","title_en":"","description_en":"","category":"","condition":"","notes":""}

規則：
- title_zh：繁體中文標題，保留品牌/型號/顏色/尺寸等關鍵資訊，不超過 40 字
- description_zh：繁體中文商品描述，語氣像認真的小型代購賣家，100~200字，保留新舊狀況與尺寸等重要細節，原文沒提到的不要瞎編
- title_en：英文標題，跟 title_zh 意思一致，保留品牌/型號等專有名詞不要亂翻
- description_en：英文商品描述，語氣自然像認真的小賣家，跟 description_zh 意思一致，100~200字
- category：從「包包、鞋類、服飾、配件、美妝保養、家電3C、生活雜貨、其他」中選一個最接近的
- condition：從「全新、近新、二手良好、二手一般、未知」中選一個，找不到線索就填「未知」
- notes：給賣家看的提醒，例如資訊不完整、找不到價格、尺寸不明等，沒有就填空字串

原始標題：${title || "(無)"}
原始描述：${description || "(無)"}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error?.message || `Gemini API 回應 HTTP ${res.status}`);
  }
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI 回應格式異常");
  return JSON.parse(match[0]);
}

exports.importProduct = onCall(
  { region: "asia-east1", timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "請先登入後台再匯入商品");
    }
    const url = (request.data && String(request.data.url || "")).trim();
    if (!/^https?:\/\//i.test(url)) {
      throw new HttpsError("invalid-argument", "請提供有效的商品連結網址 (需以 http/https 開頭)");
    }

    let html;
    try {
      html = await fetchSourceHtml(url);
    } catch (err) {
      throw new HttpsError("unavailable", `抓取來源網頁失敗：${err.message}`);
    }

    const extracted = extractFromHtml(html, url);
    if (extracted.images.length === 0) {
      throw new HttpsError(
        "not-found",
        "找不到商品照片，這個連結可能不是商品詳情頁，或該網站需要登入才看得到內容，請改用手動上傳"
      );
    }

    let bucketWarning = "";
    try {
      const bucketState = await ensurePhotoBucket();
      bucketWarning = bucketState.warning;
    } catch (err) {
      throw new HttpsError("internal", `照片儲存空間建立失敗：${err.message}`);
    }

    const productId = db().collection("products").doc().id;
    const uploadedUrls = await downloadImagesToStorage(productId, extracted.images);
    if (uploadedUrls.length === 0) {
      throw new HttpsError("internal", "商品照片下載失敗，請改用手動上傳");
    }

    let ai = {
      title_zh: "", description_zh: "", title_en: "", description_en: "",
      category: "", condition: "", notes: "",
    };
    let imported_via_ai = false;
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (apiKey) {
      try {
        ai = await refineWithGemini(apiKey, extracted.title, extracted.description);
        imported_via_ai = true;
      } catch (err) {
        ai.notes = `AI 潤飾失敗（不影響原始資料匯入，可手動編輯）：${err.message}`;
      }
    } else {
      ai.notes = "尚未設定 GEMINI_API_KEY，此筆為原文直接匯入，請人工翻譯/潤飾後再發布";
    }

    let hostname = "";
    try {
      hostname = new URL(url).hostname;
    } catch (_) {}

    const now = Date.now();
    const product = {
      title_ja: extracted.title,
      title_zh: ai.title_zh || extracted.title,
      description_ja: extracted.description,
      description_zh: ai.description_zh || "",
      title_en: ai.title_en || "",
      description_en: ai.description_en || "",
      price_jpy: extracted.currency === "JPY" ? extracted.price : null,
      price_source_currency: extracted.currency,
      price_source_value: extracted.price,
      category: ai.category || "",
      condition: ai.condition || "未知",
      photos: uploadedUrls,
      source_url: url,
      source_site: hostname,
      ai_notes: [ai.notes, bucketWarning].filter(Boolean).join(" / "),
      imported_via_ai,
      status: "draft",
      sold: false,
      is_complete: !!(ai.title_zh && ai.description_zh && extracted.price && uploadedUrls.length),
      human_edited: false,
      created_at: now,
      updated_at: now,
      created_by: request.auth.token.email || request.auth.uid,
    };

    await db().collection("products").doc(productId).set(product);
    return { id: productId, ...product };
  }
);

/**
 * 後台手動上傳商品照片。
 * 因為本專案不使用 Firebase Storage，照片改由前端送 base64 到這裡，
 * 由函式寫進公開 bucket 後回傳可直接顯示的網址。
 */
exports.uploadPhoto = onCall(
  { region: "asia-east1", timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "請先登入後台");
    const { productId, filename, contentType, dataBase64 } = request.data || {};
    if (!productId || !dataBase64) {
      throw new HttpsError("invalid-argument", "缺少 productId 或照片內容");
    }
    const buf = Buffer.from(dataBase64, "base64");
    if (buf.length > 10 * 1024 * 1024) {
      throw new HttpsError("invalid-argument", "單張照片請小於 10MB");
    }

    let warning = "";
    try {
      warning = (await ensurePhotoBucket()).warning;
    } catch (err) {
      throw new HttpsError("internal", `照片儲存空間建立失敗：${err.message}`);
    }

    const type = contentType || "image/jpeg";
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const safeName = String(filename || "photo").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 40);
    const filePath = `products/${productId}/manual_${Date.now()}_${safeName}.${ext}`;
    await bucket().file(filePath).save(buf, { metadata: { contentType: type } });

    return { url: photoPublicUrl(filePath), warning };
  }
);

/** 後台刪除商品照片（找不到檔案時視為已刪除，不報錯）。 */
exports.deletePhoto = onCall(
  { region: "asia-east1", timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "請先登入後台");
    const url = String((request.data && request.data.url) || "");
    const prefix = `https://storage.googleapis.com/${PHOTO_BUCKET}/`;
    if (!url.startsWith(prefix)) return { deleted: false };
    const filePath = url
      .slice(prefix.length)
      .split("/")
      .map(decodeURIComponent)
      .join("/");
    try {
      await bucket().file(filePath).delete();
      return { deleted: true };
    } catch (_) {
      return { deleted: false };
    }
  }
);
