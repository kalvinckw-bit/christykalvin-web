/**
 * 商品頁面解析：從 HTML 抽出標題、描述、照片網址、價格。
 * 純函式、無外部相依（除 cheerio），方便單獨測試。
 */

const cheerio = require("cheerio");


/** 把相對路徑 (/img/a.jpg、//cdn/a.jpg) 轉成絕對網址；無法解析就回傳 null。 */
function absoluteUrl(candidate, pageUrl) {
  if (!candidate || typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  try {
    return new URL(trimmed, pageUrl).toString();
  } catch (_) {
    return null;
  }
}

function extractFromHtml(html, pageUrl) {
  const $ = cheerio.load(html);
  const og = (prop) =>
    $(`meta[property="og:${prop}"]`).attr("content") ||
    $(`meta[name="og:${prop}"]`).attr("content") ||
    "";

  // 標題優先序：og:title > twitter:title > JSON-LD 商品名 > 網頁 <title>
  // (<title> 常是「商品名｜店名」這種夾雜店名的格式，所以排最後)
  let title = og("title") || $('meta[name="twitter:title"]').attr("content") || "";
  const htmlTitle = $("title").first().text().trim();
  let description =
    og("description") ||
    $('meta[name="description"]').attr("content") ||
    $('meta[name="twitter:description"]').attr("content") ||
    "";

  let images = [];
  $(
    'meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="og:image"], ' +
      'meta[name="twitter:image"], meta[name="twitter:image:src"], link[rel="image_src"]'
  ).each((_, el) => {
    const c = $(el).attr("content") || $(el).attr("href");
    if (c) images.push(c);
  });
  $('[itemprop="image"]').each((_, el) => {
    const c = $(el).attr("content") || $(el).attr("src");
    if (c) images.push(c);
  });

  let priceRaw =
    $('meta[property="product:price:amount"]').attr("content") ||
    $('meta[itemprop="price"]').attr("content") ||
    $('[itemprop="price"]').first().attr("content") ||
    null;
  let currency =
    $('meta[property="product:price:currency"]').attr("content") ||
    $('meta[itemprop="priceCurrency"]').attr("content") ||
    "JPY";

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

  // 移除 script/style 避免干擾純文字抓取（JSON-LD 已在上面解析完，這裡移除沒關係）
  $("script, style, noscript, template").remove();
  const bodyText = $("body").text().replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();

  if (!priceRaw) {
    const m = bodyText.match(/[¥￥]\s?([\d,]{2,10})/) || bodyText.match(/([\d,]{3,10})\s?円/);
    if (m) priceRaw = m[1].replace(/,/g, "");
  }

  // 相對路徑轉絕對網址，去重後最多取 8 張
  images = [...new Set(images.map((u) => absoluteUrl(u, pageUrl)).filter(Boolean))].slice(0, 8);

  const priceNum = priceRaw ? Number(String(priceRaw).replace(/[^\d.]/g, "")) : NaN;
  const price = Number.isFinite(priceNum) && priceNum > 0 ? Math.round(priceNum) : null;

  // 給 AI 用來抽取顏色/尺寸/重量/商品編號等規格資訊的原始文字，長度限制避免 prompt 過大
  const specText = bodyText.slice(0, 6000);

  return {
    title: (title || htmlTitle || "").trim(),
    description: (description || "").trim(),
    images,
    price,
    currency,
    specText,
  };
}

module.exports = { absoluteUrl, extractFromHtml };
