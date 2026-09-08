/**
 * Uniqlo / GU 商品解析器（兩家是同一個母公司 Fast Retailing、同一套電商系統）。
 *
 * 為什麼要單獨寫：他們的商品頁是 React SPA，**價格完全不在 HTML 裡**
 * （實測 959KB 的 HTML 裡找不到任何價格文字），靠 og:meta 只能拿到標題和一張圖。
 * 改打他們自己的 commerce API，反而能一次拿到原價、期間限定價、折扣截止時間、
 * 每個顏色×尺寸的價格與庫存——這正是賣服飾最需要的資料。
 *
 * 兩個端點：
 *   /{region}/api/commerce/v5/{lang}/products/{id}                    → 名稱、說明、顏色名稱、圖片
 *   /{region}/api/commerce/v5/{lang}/products/{id}/price-groups/{pg}/l2s → 每個 SKU 的價格與庫存
 */

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** 判斷網址是不是 Uniqlo/GU 商品頁，是的話拆出呼叫 API 需要的零件。 */
function parseProductUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const brand = /uniqlo\.com$/.test(host) ? "UNIQLO" : /gu-global\.com$/.test(host) ? "GU" : null;
  if (!brand) return null;

  const m = u.pathname.match(/^\/([a-z]{2})\/([a-z]{2})\/products\/([A-Za-z0-9-]+)(?:\/(\d+))?/);
  if (!m) return null;
  const [, region, lang, productId, priceGroup = "00"] = m;

  const apiBase = `${u.origin}/${region}/api/commerce/v5/${lang}`;
  return {
    brand,
    region,
    lang,
    productId,
    priceGroup,
    // 商品編號 E483535-000 → 483535，組圖片網址會用到
    goodsNo: (productId.match(/\d{4,}/) || [""])[0],
    detailUrl: `${apiBase}/products/${productId}?includeModelSize=false&httpFailure=true`,
    l2sUrl: `${apiBase}/products/${productId}/price-groups/${priceGroup}/l2s?withPrices=true&withStocks=true&includePreviousPrice=true&httpFailure=true`,
    // 使用者原本點進去時選的顏色，優先顯示這個顏色的圖
    selectedColor: u.searchParams.get("colorDisplayCode") || "",
  };
}

/** API 回應統一包在 result 裡，但偶爾會直接回本體。 */
function unwrap(json) {
  return (json && json.result) || json || {};
}

function priceValue(p) {
  const v = p && p.value;
  return typeof v === "number" ? v : null;
}

/**
 * 從 priceFlags 找出「期間限定価格」這類限時折扣資訊。
 * 例：{ code:"limitedOffer", name:"9/10まで期間限定価格",
 *       effectiveTime:{ start:1788454800, end:1789059600 } }
 */
function saleInfoFrom(l2sEntries) {
  for (const entry of l2sEntries || []) {
    const flags = (entry.flags && entry.flags.priceFlags) || [];
    for (const f of flags) {
      const end = f.effectiveTime && f.effectiveTime.end;
      if (!end) continue;
      return {
        sale_label: f.name || "",
        sale_code: f.code || "",
        // API 是秒，我們資料庫統一用毫秒
        sale_end_at: end * 1000,
        sale_start_at: (f.effectiveTime.start || 0) * 1000,
      };
    }
  }
  return { sale_label: "", sale_code: "", sale_end_at: null, sale_start_at: null };
}

/** 把 detail 端點的 l2s 拿來當「代碼 → 顯示名稱」的對照表（l2s 端點只給代碼不給名稱）。 */
function buildNameMaps(detailL2s) {
  const colorNames = new Map();
  const sizeNames = new Map();
  for (const e of detailL2s || []) {
    if (e.color && e.color.displayCode && e.color.name) {
      colorNames.set(e.color.displayCode, e.color.name);
    }
    if (e.size && e.size.displayCode && e.size.name) {
      sizeNames.set(e.size.displayCode, e.size.name);
    }
  }
  return { colorNames, sizeNames };
}

/** 從 detail 回應裡盡量挖出圖片網址（不同商品的結構不太一樣，所以寫得寬鬆一點）。 */
function imagesFromDetail(detail, info) {
  const urls = [];
  const push = (v) => {
    if (typeof v === "string" && /^https?:\/\/.+\.(jpg|jpeg|png|webp)/i.test(v)) urls.push(v);
  };
  const walk = (node, depth = 0) => {
    if (!node || depth > 4) return;
    if (typeof node === "string") return push(node);
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (/^(image|url|main|sub|chip)$/i.test(k) || typeof v === "object") walk(v, depth + 1);
      }
    }
  };
  walk(detail.images);

  // 上面挖不到就用他們固定的圖片網址格式湊，抓不到的會在下載階段自動略過。
  if (!urls.length && info.goodsNo) {
    const brandPath = info.brand === "GU" ? "GU" : "UQ";
    const base = `https://image.uniqlo.com/${brandPath}/ST3/${info.region}/imagesgoods/${info.goodsNo}`;
    const color = info.selectedColor || "01";
    urls.push(`${base}/item/${info.region}goods_${color}_${info.goodsNo}_3x4.jpg`);
    for (let i = 1; i <= 5; i++) {
      urls.push(`${base}/sub/${info.region}goods_${info.goodsNo}_sub${i}_3x4.jpg`);
    }
  }
  return [...new Set(urls)];
}

/**
 * 把兩個 API 的回應組成我們自己的商品資料。
 * 純函式、不碰網路，方便測試。
 */
function buildProduct(info, detailJson, l2sJson) {
  const detail = unwrap(detailJson);
  const l2sData = unwrap(l2sJson);

  const l2s = l2sData.l2s || [];
  const prices = l2sData.prices || {};
  const stocks = l2sData.stocks || {};
  const { colorNames, sizeNames } = buildNameMaps(detail.l2s);

  const variants = [];
  const colorSet = new Map();
  const sizeSet = new Map();
  let minPromo = null;
  let baseAtMinPromo = null;

  for (const e of l2s) {
    const l2Id = e.l2Id;
    const price = prices[l2Id] || {};
    const stock = stocks[l2Id] || {};
    const promo = priceValue(price.promo) ?? priceValue(price.base);
    const base = priceValue(price.base);

    const colorCode = (e.color && e.color.displayCode) || "";
    const sizeCode = (e.size && e.size.displayCode) || "";
    const colorName = (e.color && e.color.name) || colorNames.get(colorCode) || colorCode;
    const sizeName = (e.size && e.size.name) || sizeNames.get(sizeCode) || sizeCode;

    if (colorName) colorSet.set(colorName, true);
    if (sizeName) sizeSet.set(sizeName, true);

    const inStock = stock.statusCode === "IN_STOCK";
    variants.push({
      color: colorName,
      size: sizeName,
      price_jpy: promo,
      in_stock: inStock,
      quantity: typeof stock.quantity === "number" ? stock.quantity : null,
    });

    if (promo != null && (minPromo == null || promo < minPromo)) {
      minPromo = promo;
      baseAtMinPromo = base;
    }
  }

  const sale = saleInfoFrom(l2s);
  // 原價只有在「確實比售價高」時才記，否則前台會出現刪除線但金額一樣的怪畫面
  const originalPrice = baseAtMinPromo != null && minPromo != null && baseAtMinPromo > minPromo
    ? baseAtMinPromo
    : null;

  const description = String(detail.longDescription || detail.designDetail || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();

  return {
    title: detail.name || "",
    description,
    images: imagesFromDetail(detail, info),
    price_jpy: minPromo,
    price_original_jpy: originalPrice,
    ...sale,
    colors: [...colorSet.keys()],
    sizes: [...sizeSet.keys()],
    variants,
    product_code: info.productId,
    source_site: info.brand,
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`${url} 回應 HTTP ${res.status}`);
  return res.json();
}

/** 對外主要進入點：給商品網址，回傳整理好的商品資料。不是 Uniqlo/GU 就回 null。 */
async function fetchFastRetailingProduct(url) {
  const info = parseProductUrl(url);
  if (!info) return null;
  const [detailJson, l2sJson] = await Promise.all([
    fetchJson(info.detailUrl),
    fetchJson(info.l2sUrl),
  ]);
  return buildProduct(info, detailJson, l2sJson);
}

module.exports = {
  parseProductUrl,
  buildProduct,
  saleInfoFrom,
  fetchFastRetailingProduct,
};
