/**
 * ChristyKalvin 轉賣商城 (shopping.html) - 後台雲端函式
 *
 * importProduct: 給一個商品來源連結 (例如 Takashimaya Online、Mercari、BASE 等)，
 * 伺服器端抓取該頁面，解析 og:meta / JSON-LD 商品資料，把照片下載搬到自己的
 * Firebase Storage（避免原網站下架後圖片失效），有設定 ANTHROPIC_API_KEY 的話
 * 再呼叫 Claude 把原文標題/描述潤飾翻譯成繁體中文小賣家口吻。
 *
 * 匯入結果一律先寫成 status:"draft"，需要後台人工核對後才會發布 (published)，
 * 沿用本專案 myproperty 後台「未審核 / 已審核」的人工複核習慣。
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { randomUUID } = require("crypto");
const cheerio = require("cheerio");

initializeApp();

const DB_ID = "christykalvin-db";
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function db() {
  return getFirestore(DB_ID);
}

function bucket() {
  return getStorage().bucket();
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

function extractFromHtml(html) {
  const $ = cheerio.load(html);
  const og = (prop) =>
    $(`meta[property="og:${prop}"]`).attr("content") ||
    $(`meta[name="og:${prop}"]`).attr("content") ||
    "";

  let title = og("title") || $("title").first().text().trim();
  let description = og("description") || $('meta[name="description"]').attr("content") || "";

  let images = [];
  $('meta[property="og:image"], meta[property="og:image:secure_url"]').each((_, el) => {
    const c = $(el).attr("content");
    if (c) images.push(c);
  });

  let priceRaw = null;
  let currency = "JPY";

  $('script[type="application/ld+json"]').each((_, el) => {
    let parsed;
    try {
      parsed = JSON.parse($(el).contents().text());
    } catch (_) {
      return;
    }
    const nodes = Array.isArray(parsed) ? parsed : parsed["@graph"] || [parsed];
    for (const node of nodes) {
      if (!node) continue;
      const type = node["@type"];
      const isProduct = type === "Product" || (Array.isArray(type) && type.includes("Product"));
      if (!isProduct) continue;
      if (!title && node.name) title = node.name;
      if (!description && node.description) description = node.description;
      if (node.image) {
        const imgs = Array.isArray(node.image) ? node.image : [node.image];
        images.push(...imgs.filter((x) => typeof x === "string"));
      }
      const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
      if (offer) {
        if (offer.price) priceRaw = offer.price;
        if (offer.priceCurrency) currency = offer.priceCurrency;
      }
    }
  });

  if (!priceRaw) {
    const bodyText = $("body").text();
    const m = bodyText.match(/[¥￥]\s?([\d,]{2,10})/);
    if (m) priceRaw = m[1].replace(/,/g, "");
  }

  images = [...new Set(images)].slice(0, 8);
  const price = priceRaw ? Math.round(Number(String(priceRaw).replace(/,/g, ""))) : null;

  return { title: title || "", description: description || "", images, price, currency };
}

async function downloadImagesToStorage(productId, imageUrls) {
  const b = bucket();
  const uploaded = [];
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      const res = await fetch(imageUrls[i], { headers: { "User-Agent": BROWSER_UA } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") || "image/jpeg";
      const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
      const filePath = `products/${productId}/${i}.${ext}`;
      const token = randomUUID();
      const file = b.file(filePath);
      await file.save(buf, {
        metadata: { contentType, metadata: { firebaseStorageDownloadTokens: token } },
      });
      const encodedPath = encodeURIComponent(filePath);
      uploaded.push(
        `https://firebasestorage.googleapis.com/v0/b/${b.name}/o/${encodedPath}?alt=media&token=${token}`
      );
    } catch (_) {
      // 單張圖失敗不影響其他圖片，略過即可
    }
  }
  return uploaded;
}

async function refineWithClaude(apiKey, title, description) {
  const prompt = `以下是一個日本網店商品頁面抓到的原始標題與描述，你要幫忙做「代購轉賣」上架用的文案整理，請只回傳純 JSON，不要加任何說明文字：
{"title_zh":"","description_zh":"","category":"","condition":"","notes":""}

規則：
- title_zh：繁體中文標題，保留品牌/型號/顏色/尺寸等關鍵資訊，不超過 40 字
- description_zh：繁體中文商品描述，語氣像認真的小型代購賣家，100~200字，保留新舊狀況與尺寸等重要細節，原文沒提到的不要瞎編
- category：從「包包、鞋類、服飾、配件、美妝保養、家電3C、生活雜貨、其他」中選一個最接近的
- condition：從「全新、近新、二手良好、二手一般、未知」中選一個，找不到線索就填「未知」
- notes：給賣家看的提醒，例如資訊不完整、找不到價格、尺寸不明等，沒有就填空字串

原始標題：${title || "(無)"}
原始描述：${description || "(無)"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await res.json();
  const text = json?.content?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI 回應格式異常");
  return JSON.parse(match[0]);
}

exports.importProduct = onCall(
  { secrets: [ANTHROPIC_API_KEY], region: "asia-east1", timeoutSeconds: 120, memory: "512MiB" },
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

    const extracted = extractFromHtml(html);
    if (extracted.images.length === 0) {
      throw new HttpsError(
        "not-found",
        "找不到商品照片，這個連結可能不是商品詳情頁，或該網站需要登入才看得到內容，請改用手動上傳"
      );
    }

    const productId = db().collection("products").doc().id;
    const uploadedUrls = await downloadImagesToStorage(productId, extracted.images);
    if (uploadedUrls.length === 0) {
      throw new HttpsError("internal", "商品照片下載失敗，請改用手動上傳");
    }

    let ai = { title_zh: "", description_zh: "", category: "", condition: "", notes: "" };
    let imported_via_ai = false;
    let apiKey = "";
    try {
      apiKey = ANTHROPIC_API_KEY.value();
    } catch (_) {
      apiKey = "";
    }
    if (apiKey) {
      try {
        ai = await refineWithClaude(apiKey, extracted.title, extracted.description);
        imported_via_ai = true;
      } catch (err) {
        ai.notes = `AI 潤飾失敗（不影響原始資料匯入，可手動編輯）：${err.message}`;
      }
    } else {
      ai.notes = "尚未設定 ANTHROPIC_API_KEY，此筆為原文直接匯入，請人工翻譯/潤飾後再發布";
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
      price_jpy: extracted.currency === "JPY" ? extracted.price : null,
      price_source_currency: extracted.currency,
      price_source_value: extracted.price,
      category: ai.category || "",
      condition: ai.condition || "未知",
      photos: uploadedUrls,
      source_url: url,
      source_site: hostname,
      ai_notes: ai.notes || "",
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
