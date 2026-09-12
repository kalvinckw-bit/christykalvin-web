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
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { Storage } = require("@google-cloud/storage");
const { extractFromHtml } = require("./extract");
const { fetchFastRetailingProduct } = require("./fastretailing");
const { isPremicoUrl, parsePremicoHtml } = require("./premico");
const { DEFAULT_PRICING, computePrices } = require("./pricing");

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

/**
 * 取得 Gemini API 金鑰。
 *
 * 優先讀環境變數（functions/.env，本機部署時會帶上去）；
 * 但 .env 沒有進 git，CI 部署時看不到它，一部署就會把線上金鑰洗掉、AI 直接停擺。
 * 所以改成環境變數沒有時，退而從 Firestore 的 settings/ai 讀取
 * （該集合只有登入的管理員讀得到，前台訪客讀不到）。
 */
let cachedGeminiKey = null;
async function loadGeminiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (cachedGeminiKey) return cachedGeminiKey;
  try {
    const doc = await db().collection("settings").doc("ai").get();
    const key = doc.exists ? doc.data().gemini_api_key : "";
    if (key) cachedGeminiKey = key;
    return key || "";
  } catch (_) {
    return "";
  }
}

/** 讀後台設定的加價規則；沒設定過就用預設值。 */
async function loadPricingSettings() {
  try {
    const doc = await db().collection("settings").doc("pricing").get();
    if (doc.exists) {
      const data = doc.data();
      if (data && data.rules) return data;
    }
  } catch (_) {
    // 設定讀不到就用預設，不能因此讓匯入整個失敗
  }
  return DEFAULT_PRICING;
}

// 分類清單的預設值（賣家還沒在後台自訂過分類時使用，也是第一次寫入 settings/categories 時的種子資料）
const DEFAULT_CATEGORIES = ["包包", "鞋類", "服飾", "配件", "美妝保養", "家電3C", "生活雜貨", "食品零食", "其他"];

/**
 * 讀後台自訂的商品分類清單，讓 AI 分類時用賣家自己定義的分類，
 * 而不是寫死在程式碼裡——賣家在後台新增分類後，匯入商品時 AI 就該挑得到那個新分類。
 */
async function loadCategories() {
  try {
    const doc = await db().collection("settings").doc("categories").get();
    if (doc.exists) {
      const list = doc.data() && doc.data().list;
      const zhNames = (Array.isArray(list) ? list : []).map((c) => c && c.zh).filter(Boolean);
      if (zhNames.length) return zhNames;
    }
  } catch (_) {
    // 讀不到就用預設，不能因此讓匯入整個失敗
  }
  return DEFAULT_CATEGORIES;
}

/**
 * Gemini 有時候不理會 prompt 裡「不要發明清單以外分類」的指示，
 * 直接生出清單以外的分類名稱（賣家實際回報過：清單裡沒有「藥妝」，
 * AI 還是生出了這個分類）。分類清單是賣家自己在後台管理的東西，
 * 不能讓 AI 越權把賣家沒新增過的分類硬塞進資料庫，否則「讓賣家自己
 * 管理分類」這個功能就形同虛設。比對不到清單裡的項目就留空、記一筆
 * 提示，讓賣家自己決定要手動選一個現有分類，還是把這個新名稱加進
 * 分類清單。
 */
function resolveCategory(aiCategory, categories) {
  const list = Array.isArray(categories) ? categories : [];
  const trimmed = (aiCategory || "").trim();
  if (!trimmed) return { category: "", note: "" };
  if (list.includes(trimmed)) return { category: trimmed, note: "" };
  return {
    category: "",
    note: `AI 建議分類「${trimmed}」不在目前的分類清單中，已略過（請自行從清單挑一個，或去「加價設定」分頁新增這個分類）`,
  };
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

// 主要模型 + 備援模型。Gemini 偶爾會回 503「high demand」，
// 之前只呼叫一次就放棄，導致匯入的商品標題/描述整個空白（實際發生過三筆）。
// 現在會依序重試，同一個模型先退避重試，仍失敗才換下一個模型。
const GEMINI_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite"];
const GEMINI_ATTEMPTS_PER_MODEL = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function callGemini(apiKey, model, prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
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
    const err = new Error(json?.error?.message || `Gemini API 回應 HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI 回應格式異常");
  return JSON.parse(match[0]);
}

async function refineWithGemini(apiKey, title, description, specText, categories) {
  const catList = (Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES).join("、");
  const prompt = `以下是一個日本網店商品頁面抓到的原始標題、描述、以及頁面上的規格內文，你要幫忙做「代購轉賣」上架用的文案整理，同時做一份英文版給國際買家看，並從規格內文抽出顏色/尺寸/重量等規格資訊。請只回傳純 JSON，不要加任何說明文字：
{"title_ja":"","description_zh":"","title_en":"","description_en":"","category":"","condition":"","notes":"","colors":[],"size":"","weight":"","spec_notes":"","product_code":""}

規則：
- title_ja：把原始標題整理成乾淨的商品名稱。**絕對不要翻成中文**，商品名稱維持原文（日文/英文/羅馬字都照原樣保留）。只做清理：去掉「ユニクロ公式 |」「GU公式 |」「楽天市場」這類網站名稱雜訊、去掉「送料無料」「ポイント10倍」這類促銷字眼，保留品牌、商品名、型號、規格。不超過 50 字
- description_zh：繁體中文商品描述（描述用中文，但裡面出現的品牌名/商品名一樣保留原文不要翻），語氣像認真的小型代購賣家，100~200字，保留新舊狀況與尺寸等重要細節，原文沒提到的不要瞎編
- title_en：英文商品名稱，給看英文的客人。品牌名/型號保留原樣不要亂翻，只把日文的品項說明部分翻成英文（例如「バターサンド」→「Butter Sandwich Cookies」）。這個欄位絕對不能留空：原文本來就是英文/羅馬字的話，直接沿用同一個名稱即可
- description_en：英文商品描述，語氣自然像認真的小賣家，跟 description_zh 意思一致，100~200字
- category：從「${catList}」中選一個最接近的（餅乾、和菓子、伴手禮、飲料、調味料等入口的東西優先選跟食品相關的分類；清單裡找不到適合的就選最接近的一個，不要自己發明清單以外的分類）
- condition：從「全新、近新、二手良好、二手一般、未知」中選一個，找不到線索就填「全新」（本店商品多為全新代購，除非原文明確提到二手/使用痕跡才選其他）
- notes：給賣家看的提醒，例如資訊不完整、找不到價格、尺寸不明等，沒有就填空字串
- colors：從規格內文的「色」欄位抽出可選顏色，翻成繁體中文，陣列形式，例如日文「チャコールブラック／さくらピンク」要拆成 ["炭黑色","櫻花粉"]；規格內文沒有顏色選項就回傳空陣列 []
- size：規格內文的「サイズ／尺寸」欄位原文照抄，找不到就填空字串
- weight：規格內文的「重さ／重量」欄位原文照抄，找不到就填空字串
- spec_notes：規格內文裡其他值得買家知道的規格重點（例如電源規格、附屬品），簡短列點，100字內，找不到就填空字串
- product_code：規格內文的「商品番号」或「品番」欄位原文照抄，找不到就填空字串

原始標題：${title || "(無)"}
原始描述：${description || "(無)"}
頁面規格內文（可能包含雜訊，只挑跟商品規格相關的部分）：
${specText ? specText.slice(0, 4000) : "(無)"}`;

  // 依序嘗試每個模型；遇到 429/503（額度或模型過載）先退避重試，
  // 該模型重試用完才換下一個模型。非暫時性錯誤（例如 400）直接換模型不浪費時間。
  let lastErr;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 1; attempt <= GEMINI_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        return await callGemini(apiKey, model, prompt);
      } catch (err) {
        lastErr = err;
        const transient = err.status === 429 || err.status === 503 || err.status >= 500;
        if (!transient || attempt === GEMINI_ATTEMPTS_PER_MODEL) break;
        await sleep(attempt * 1500);
      }
    }
  }
  throw new Error(`所有模型都失敗，最後錯誤：${lastErr ? lastErr.message : "未知"}`);
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

    // Uniqlo / GU 的價格不在 HTML 裡（是 JS 打 API 拿的），
    // 所以這兩家先走專用解析器，拿得到原價、期間限定價、截止時間、尺寸與庫存。
    // 失敗的話不擋流程，退回下面的通用解析器至少把標題圖片抓進來。
    let apparel = null;
    let apparelError = "";
    try {
      apparel = await fetchFastRetailingProduct(url);
    } catch (err) {
      apparelError = `Uniqlo/GU 專用解析失敗，改用一般解析：${err.message}`;
    }

    let html;
    try {
      html = await fetchSourceHtml(url);
    } catch (err) {
      throw new HttpsError("unavailable", `抓取來源網頁失敗：${err.message}`);
    }

    const extracted = extractFromHtml(html, url);
    if (apparel) {
      // 專用解析器拿到的資料比較準，優先採用；沒拿到的欄位再用通用解析器補
      if (apparel.title) extracted.title = apparel.title;
      if (apparel.description) extracted.description = apparel.description;
      if (apparel.images.length) extracted.images = [...apparel.images, ...extracted.images];
      if (apparel.price_jpy != null) {
        extracted.price = apparel.price_jpy;
        extracted.currency = "JPY";
      }
    }
    // PREMICO（iei.jp）預購頁：同一頁列出分期金額、一括價格稅前/稅後、運費稅前/稅後好幾個數字，
    // 通用解析器只會抓到第一個看到的金額（分期月付金），不是賣家實際要付的成本；
    // 商品照片是內文 <img>（gallery_XX.jpg），og:image 之外通用解析器也掃不到。
    if (isPremicoUrl(url)) {
      try {
        const premico = parsePremicoHtml(html, url);
        if (premico.images.length) {
          extracted.images = [...new Set([...premico.images, ...extracted.images])];
        }
        if (premico.price_jpy != null) {
          extracted.price = premico.price_jpy;
          extracted.currency = "JPY";
        }
      } catch (err) {
        apparelError = apparelError || `PREMICO 專用解析失敗，改用一般解析：${err.message}`;
      }
    }
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
      title_ja: "", description_zh: "", title_en: "", description_en: "",
      category: "", condition: "", notes: "",
      colors: [], size: "", weight: "", spec_notes: "", product_code: "",
    };
    let imported_via_ai = false;
    const categories = await loadCategories();
    const apiKey = await loadGeminiKey();
    if (apiKey) {
      try {
        ai = await refineWithGemini(apiKey, extracted.title, extracted.description, extracted.specText, categories);
        imported_via_ai = true;
      } catch (err) {
        ai.notes = `AI 潤飾失敗（不影響原始資料匯入，可手動編輯）：${err.message}`;
      }
    } else {
      ai.notes = "尚未設定 Gemini 金鑰（環境變數與 settings/ai 都沒有），此筆為原文直接匯入，請人工潤飾後再發布";
    }
    const catResolved = resolveCategory(ai.category, categories);

    let hostname = "";
    try {
      hostname = new URL(url).hostname;
    } catch (_) {}

    // 套用加價規則：來源價是成本，實際售價由設定決定
    const sourceSite = (apparel && apparel.source_site) || hostname;
    const costJpy = extracted.currency === "JPY" ? extracted.price : null;
    const costOriginalJpy = (apparel && apparel.price_original_jpy) || null;
    const pricing = await loadPricingSettings();
    const pricedFor = computePrices(
      { cost_jpy: costJpy, cost_original_jpy: costOriginalJpy, source_site: sourceSite },
      pricing
    );

    const now = Date.now();
    const product = {
      // 商品名稱不翻中文：中文介面顯示 title_ja、英文介面顯示 title_en
      title_ja: ai.title_ja || extracted.title,
      description_ja: extracted.description,
      description_zh: ai.description_zh || "",
      title_en: ai.title_en || ai.title_ja || extracted.title || "",
      description_en: ai.description_en || "",
      // 顏色優先順序：Uniqlo/GU 專用解析器 > 通用解析器從 DOM 抓到的色塊 title
      // （實測 peachjohn.co.jp 這種色塊選色的網站）> AI 用猜的（都抓不到才退這步）
      colors: (apparel && apparel.colors.length)
        ? apparel.colors
        : (extracted.colors && extracted.colors.length)
          ? extracted.colors
          : (Array.isArray(ai.colors) ? ai.colors.filter((c) => typeof c === "string" && c.trim()) : []),
      // 服飾用的尺寸清單（S/M/L…）；家電那種單一尺寸描述仍走 size 欄位。
      // 優先序跟顏色一樣：Uniqlo/GU 專用解析器 > 通用解析器從 DOM 抓到的
      // radio+label 尺寸選項（實測 peachjohn.co.jp）> 沒有就空陣列
      sizes: (apparel && apparel.sizes && apparel.sizes.length)
        ? apparel.sizes
        : (extracted.sizes && extracted.sizes.length ? extracted.sizes : []),
      variants: (apparel && apparel.variants) || [],
      size: ai.size || "",
      weight: ai.weight || "",
      spec_notes: ai.spec_notes || "",
      product_code: (apparel && apparel.product_code) || ai.product_code || "",
      // 只存賣給客人的價格。進貨成本與加價％數是營業機密，
      // 另外存在 product_costs（僅管理員可讀），因為 products 的已上架商品是公開可讀的。
      price_jpy: pricedFor.price_jpy,
      // 期間限定價／折扣：原價（已含加價）、折扣標籤、折扣截止時間（毫秒）
      price_original_jpy: pricedFor.price_original_jpy,
      sale_label: (apparel && apparel.sale_label) || "",
      sale_end_at: (apparel && apparel.sale_end_at) || null,
      price_source_currency: extracted.currency,
      price_source_value: extracted.price,
      category: catResolved.category,
      condition: ai.condition || "全新",
      photos: uploadedUrls,
      source_url: url,
      source_site: sourceSite,
      ai_notes: [ai.notes, catResolved.note, apparelError, bucketWarning].filter(Boolean).join(" / "),
      imported_via_ai,
      // 匯入結果直接上架（賣家 2026-09-10 要求，不再強制人工複核才發布）
      status: "published",
      sold: false,
      is_complete: !!((ai.title_ja || extracted.title) && ai.description_zh && pricedFor.price_jpy && uploadedUrls.length),
      human_edited: false,
      created_at: now,
      updated_at: now,
      created_by: request.auth.token.email || request.auth.uid,
    };

    await db().collection("products").doc(productId).set(product);

    // 成本與加價設定另外存，避免隨著公開商品資料外流
    await db().collection("product_costs").doc(productId).set({
      cost_jpy: costJpy,
      cost_original_jpy: costOriginalJpy,
      markup_type: "",
      markup_value: null,
      source_site: sourceSite,
      applied_rule: pricedFor.markup_applied,
      updated_at: now,
    });

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

/**
 * 瀏覽器書籤工具匯入：給 Amazon、Yodobashi 這類會直接擋掉伺服器端請求的網站用。
 *
 * importProduct 是「伺服器主動連線來源網站」，Amazon 會回傳機器人驗證頁、
 * Yodobashi（Akamai）直接 403，兩者都不是解析規則能解決的問題——
 * 是對方看雲端機房 IP 就攔。真正能繞過去的只有「使用者自己的瀏覽器」，
 * 因為那本來就是一般訪客的正常連線。
 *
 * 做法：後台提供一個瀏覽器書籤（bookmarklet），使用者在商品頁按一下，
 * 書籤裡的 JS 直接讀取當下瀏覽器已經載入好的頁面內容（不是重新發請求），
 * 抓出標題/價格/圖片/描述，複製成一段 JSON，貼回這裡即可。
 * 商品照片一樣改抓到自己的 bucket；沒有規格內文可以給 AI 抽規格，
 * 所以顏色/尺寸/重量這些欄位這裡不會有，需要的話後台手動補。
 */
exports.importFromData = onCall(
  { region: "asia-east1", timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "請先登入後台");
    const d = request.data || {};
    const url = String(d.url || "").trim();
    const title = String(d.title || "").trim();
    const description = String(d.description || "").trim();
    const images = Array.isArray(d.images)
      ? d.images.filter((u) => typeof u === "string" && u.trim()).slice(0, 8)
      : [];
    const priceNum = Number(d.price);

    if (!/^https?:\/\//i.test(url)) {
      throw new HttpsError("invalid-argument", "缺少來源網址");
    }
    if (images.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "書籤工具沒有抓到任何照片，可能該網站頁面結構改版了，請改用手動上傳"
      );
    }

    let hostname = "";
    try {
      hostname = new URL(url).hostname;
    } catch (_) {}
    const sourceSite = String(d.source_site || hostname);

    let bucketWarning = "";
    try {
      bucketWarning = (await ensurePhotoBucket()).warning;
    } catch (err) {
      throw new HttpsError("internal", `照片儲存空間建立失敗：${err.message}`);
    }

    const productId = db().collection("products").doc().id;
    const uploadedUrls = await downloadImagesToStorage(productId, images);
    if (uploadedUrls.length === 0) {
      throw new HttpsError(
        "internal",
        "商品照片下載失敗（來源圖片網址可能也擋雲端流量），請改用手動上傳"
      );
    }

    let ai = {
      title_ja: "", description_zh: "", title_en: "", description_en: "",
      category: "", condition: "", notes: "",
      colors: [], size: "", weight: "", spec_notes: "", product_code: "",
    };
    let imported_via_ai = false;
    const categories = await loadCategories();
    const apiKey = await loadGeminiKey();
    if (apiKey) {
      try {
        // 書籤工具抓不到頁面規格內文，只有標題/描述，specText 給空字串即可
        ai = await refineWithGemini(apiKey, title, description, "", categories);
        imported_via_ai = true;
      } catch (err) {
        ai.notes = `AI 潤飾失敗（不影響原始資料匯入，可手動編輯）：${err.message}`;
      }
    } else {
      ai.notes = "尚未設定 Gemini 金鑰，此筆為原文直接匯入，請人工潤飾後再發布";
    }
    const catResolved = resolveCategory(ai.category, categories);

    const costJpy = Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum) : null;
    const pricing = await loadPricingSettings();
    const pricedFor = computePrices(
      { cost_jpy: costJpy, cost_original_jpy: null, source_site: sourceSite },
      pricing
    );

    const now = Date.now();
    const product = {
      title_ja: ai.title_ja || title,
      description_ja: description,
      description_zh: ai.description_zh || "",
      title_en: ai.title_en || ai.title_ja || title || "",
      description_en: ai.description_en || "",
      colors: [],
      sizes: [],
      variants: [],
      size: "",
      weight: "",
      spec_notes: "",
      product_code: "",
      price_jpy: pricedFor.price_jpy,
      price_original_jpy: null,
      sale_label: "",
      sale_end_at: null,
      price_source_currency: "JPY",
      price_source_value: costJpy,
      category: catResolved.category,
      condition: ai.condition || "全新",
      photos: uploadedUrls,
      source_url: url,
      source_site: sourceSite,
      ai_notes: [ai.notes, catResolved.note, bucketWarning, "透過瀏覽器書籤工具匯入（伺服器連不到此網站）"]
        .filter(Boolean).join(" / "),
      imported_via_ai,
      // 匯入結果直接上架（賣家 2026-09-10 要求，不再強制人工複核才發布）
      status: "published",
      sold: false,
      is_complete: !!((ai.title_ja || title) && ai.description_zh && pricedFor.price_jpy && uploadedUrls.length),
      human_edited: false,
      created_at: now,
      updated_at: now,
      created_by: request.auth.token.email || request.auth.uid,
    };

    await db().collection("products").doc(productId).set(product);
    await db().collection("product_costs").doc(productId).set({
      cost_jpy: costJpy,
      cost_original_jpy: null,
      markup_type: "",
      markup_value: null,
      source_site: sourceSite,
      applied_rule: pricedFor.markup_applied,
      updated_at: now,
    });

    return { id: productId, ...product };
  }
);

/**
 * 每天回查一次來源網站的價格（目前支援 Uniqlo / GU）。
 *
 * 賣代購最怕兩件事：來源悄悄漲價、限時特價結束了但自己網站還掛著舊特價。
 * 客人看到便宜價格來問，賣家才發現要漲價，非常難收場。
 * 這支排程就是在客人開口之前先把差異抓出來，寫進商品的 price_alert 欄位，
 * 後台會直接顯示紅字提示。
 *
 * 只更新提示欄位，不會自動改售價 —— 要賣多少錢是老闆的決定，不是程式的。
 */
exports.watchSourcePrices = onSchedule(
  { schedule: "every day 09:00", timeZone: "Asia/Tokyo", region: "asia-east1", timeoutSeconds: 540 },
  async () => {
    const pricing = await loadPricingSettings();
    const snap = await db()
      .collection("products")
      .where("status", "==", "published")
      .get();

    let checked = 0;
    let alerted = 0;

    for (const doc of snap.docs) {
      const p = doc.data();
      if (p.sold || !p.source_url) continue;

      const alerts = [];
      const now = Date.now();

      // 1) 特價已經過期，網站上還掛著特價
      if (p.sale_end_at && p.sale_end_at < now && p.price_original_jpy) {
        alerts.push(`限時特價已於 ${new Date(p.sale_end_at).toLocaleDateString("zh-TW")} 結束，前台已自動改回原價 ¥${Number(p.price_original_jpy).toLocaleString()}，請確認是否要調整售價`);
      }

      // 2) 來源網站的「成本價」變了
      try {
        const fresh = await fetchFastRetailingProduct(p.source_url);
        if (fresh && fresh.price_jpy != null) {
          checked++;
          const costDoc = await db().collection("product_costs").doc(doc.id).get();
      const costData = costDoc.exists ? costDoc.data() : {};
      const oldCost = Number(costData.cost_jpy) || Number(p.price_jpy);
          if (oldCost && fresh.price_jpy !== oldCost) {
            const diff = fresh.price_jpy - oldCost;
            // 依目前的加價規則換算成新的建議售價，老闆一眼就知道該賣多少
            const suggested = computePrices(
              {
                cost_jpy: fresh.price_jpy,
                cost_original_jpy: fresh.price_original_jpy,
                source_site: p.source_site,
                markup_type: costData.markup_type,
                markup_value: costData.markup_value,
              },
              pricing
            );
            alerts.push(
              `來源成本從 ¥${oldCost.toLocaleString()} 變成 ¥${fresh.price_jpy.toLocaleString()}` +
              `（${diff > 0 ? "漲" : "降"} ¥${Math.abs(diff).toLocaleString()}）` +
              `，依目前加價規則建議售價 ¥${Number(suggested.price_jpy).toLocaleString()}` +
              `（目前掛 ¥${Number(p.price_jpy).toLocaleString()}）`
            );
          }
          // 順便更新庫存，缺貨的尺寸前台才擋得住
          if (fresh.variants && fresh.variants.length) {
            await doc.ref.update({ variants: fresh.variants, stock_checked_at: now });
          }
          await db().collection("product_costs").doc(doc.id).set(
            { cost_jpy: fresh.price_jpy, cost_original_jpy: fresh.price_original_jpy, updated_at: now },
            { merge: true }
          );
          const allOut = fresh.variants && fresh.variants.length &&
            fresh.variants.every((v) => !v.in_stock);
          if (allOut) alerts.push("來源網站所有尺寸都已缺貨");
        }
      } catch (err) {
        // 來源網站抓不到不算錯誤（可能商品已下架），記下來讓人工判斷
        alerts.push(`來源網站查價失敗：${err.message}`);
      }

      if (alerts.length) {
        alerted++;
        await doc.ref.update({
          price_alert: alerts.join(" / "),
          price_alert_at: now,
        });
      } else if (p.price_alert) {
        // 問題已經解決就把提示清掉
        await doc.ref.update({ price_alert: "", price_alert_at: null });
      }
    }

    console.log(`查價完成：檢查 ${checked} 筆，${alerted} 筆有異常`);
  }
);

/**
 * 版本回報端點（公開，只回傳 git commit SHA，沒有任何機密）。
 *
 * 為什麼需要：部署流程原本只驗證 HTML 檔案，functions 那半邊完全沒檢查，
 * 結果 functions 被誤部署到另一個專案（voiceout-asia）長達好幾輪都沒被發現——
 * 每次都顯示「部署成功」，實際上線上跑的是舊程式碼。
 * 有了這個端點，CI 部署後可以直接比對「線上函式的版本」與「這次要部署的版本」，
 * 不一致就讓部署失敗，不會再有靜默的假成功。
 */
const { onRequest } = require("firebase-functions/v2/https");
let deployedVersion = null;
exports.version = onRequest({ region: "asia-east1", cors: true }, (req, res) => {
  if (!deployedVersion) {
    try {
      deployedVersion = require("./version.json");
    } catch (_) {
      deployedVersion = { sha: "unknown", note: "版本檔不存在（可能是本機手動部署）" };
    }
  }
  res.json(deployedVersion);
});
