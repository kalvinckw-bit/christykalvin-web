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

  // 有些網站的顏色選項是色塊/縮圖形式（不是下拉選單），色塊本身沒有可見文字，
  // 顏色名稱只放在 title 屬性裡（實測 peachjohn.co.jp：
  // <dl class="block-variation--item block-color--item" title="アイボリー">…</dl>，
  // 其他顏色的 <dl> 甚至是連到別的商品網址，色塊本身完全沒有可見文字可以抓）。
  // 抓 class 名稱含「color」且有 title 屬性的元素，把 title 收集起來當顏色選項。
  let colors = [];
  $('[class*="color"][title]').each((_, el) => {
    const t = ($(el).attr("title") || "").trim();
    if (t && t.length <= 20 && !colors.includes(t)) colors.push(t);
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

  // 先把 meta/JSON-LD 抓到的網址轉成絕對網址、去重（還不截斷成 8 張，
  // 因為等下要拿第一張圖的檔名當基準去找同系列的其他照片）。
  images = [...new Set(images.map((u) => absoluteUrl(u, pageUrl)).filter(Boolean))];

  // 有些網站 og:image / JSON-LD 只給一張代表圖，真正完整的商品照片是內文用
  // data-src 這類屬性延遲載入的（實測 peachjohn.co.jp：JSON-LD 只有 1 張，
  // 頁面內文其實有 6 張，全部用 <img src="lazyloading.png" data-src="真正圖檔">
  // 這種寫法）。同一件商品的照片檔名通常是「商品編號_序號.副檔名」這種規律
  // （例如 103177001_01.jpg ~ 103177001_06.jpg）。拿第一張已知圖片的檔名反推出
  // 這個編號前綴，再去內文所有 <img> 的 src/data-src/srcset 找同前綴的圖——
  // 不用知道這個網站怎麼命名 class，也不會誤收同一頁其他推薦商品、banner 的
  // 圖片（檔名前綴對不起來，不會被找到）。
  const galleryPrefix = (() => {
    for (const u of images) {
      const m = u.match(/([A-Za-z0-9]{5,})_\d{1,3}\.(?:jpe?g|png|webp)(?:$|\?)/i);
      if (m) return m[1];
    }
    return null;
  })();
  if (galleryPrefix && images.length < 8) {
    const seen = new Set(images);
    const galleryRe = new RegExp(
      `${galleryPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_\\d{1,3}\\.(?:jpe?g|png|webp)`,
      "i"
    );
    $("img").each((_, el) => {
      if (images.length >= 8) return;
      const candidates = [
        $(el).attr("src"),
        $(el).attr("data-src"),
        $(el).attr("data-original"),
        $(el).attr("data-lazy-src"),
        $(el).attr("data-zoom-image"),
      ].filter(Boolean);
      const srcset = $(el).attr("srcset") || $(el).attr("data-srcset");
      if (srcset) srcset.split(",").forEach((part) => candidates.push(part.trim().split(/\s+/)[0]));
      for (const c of candidates) {
        if (!c || !galleryRe.test(c)) continue;
        const abs = absoluteUrl(c, pageUrl);
        if (abs && !seen.has(abs)) {
          seen.add(abs);
          images.push(abs);
        }
      }
    });
  }

  images = images.slice(0, 8);

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
    colors,
  };
}

module.exports = { absoluteUrl, extractFromHtml };
