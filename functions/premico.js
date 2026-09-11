/**
 * iei.jp（PREMICO 預購頁）商品解析。
 *
 * 為什麼要單獨寫：這是「LP 頁」格式，跟一般電商商品頁完全不同：
 * 1. 同一頁會列出好幾個金額——每月分期金額、一次性付款的稅前/稅後價、
 *    運費的稅前/稅後價。通用解析器只會抓「第一個看到的金額」，
 *    實測會抓到「月々6,100円」的 6100，但賣家真正的進貨成本是
 *    「一括価格（税込）」加上「発送手数料（税込）」兩個數字相加。
 * 2. 商品照片是內文 <img> 標籤（gallery_01.jpg 這類檔名），不是走
 *    og:image / JSON-LD，通用解析器完全掃不到，只抓得到 og:image 那一張。
 */

const cheerio = require("cheerio");

function isPremicoUrl(url) {
  try {
    return /(^|\.)iei\.jp$/i.test(new URL(url).hostname);
  } catch (_) {
    return false;
  }
}

function toNumber(raw) {
  if (!raw) return null;
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * 解析 PREMICO 商品頁的 HTML，取得正確的成本（一括價含稅 + 運費含稅）與商品照片。
 * 純函式、不碰網路，方便測試；抓不到就回傳 null 欄位，呼叫端自己決定要不要退回通用解析結果。
 */
function parsePremicoHtml(html, pageUrl) {
  const $ = cheerio.load(html);

  // 真正的商品照片放在內文 <img src="/premico/lp/{id}/gallery_XX.jpg">，
  // 同一個資料夾底下還有 logo、電話按鈕、頁尾版權圖這類跟商品無關的雜訊，
  // 只挑「gallery_數字」或首圖 sp_keyvisual 這兩種檔名。
  const imgSrcs = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    if (src) imgSrcs.push(src);
  });
  const images = [
    ...new Set(
      imgSrcs
        .filter((src) => /\/premico\/lp\/[^/]+\/(gallery_\d+|sp_keyvisual)[^/]*\.(jpg|jpeg|png|webp)/i.test(src))
        .map((src) => {
          try {
            return new URL(src, pageUrl).toString();
          } catch (_) {
            return null;
          }
        })
        .filter(Boolean)
    ),
  ];

  $("script, style, noscript, template").remove();
  const bodyText = $("body").text().replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n");

  // 「一括価格 69,800円（税込76,780円）」「発送手数料 700円（税込770円）」
  // 只取稅込（含稅）那個數字——賣家實際要付的是含稅價，不是稅前的標示價。
  const lumpMatch = bodyText.match(/一括価格\s*[\d,]+\s*円\s*[（(]\s*税込\s*([\d,]+)\s*円\s*[）)]/);
  const shipMatch = bodyText.match(/発送手数料\s*[\d,]+\s*円\s*[（(]\s*税込\s*([\d,]+)\s*円\s*[）)]/);
  const lump = toNumber(lumpMatch && lumpMatch[1]);
  const shippingFee = toNumber(shipMatch && shipMatch[1]) || 0;

  return {
    price_jpy: lump != null ? lump + shippingFee : null,
    shipping_fee_jpy: shipMatch ? shippingFee : null,
    images,
  };
}

module.exports = { isPremicoUrl, parsePremicoHtml };
