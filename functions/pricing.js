/**
 * 售價計算：來源價 →（加價規則）→ 實際賣給客人的價格。
 *
 * 為什麼需要這個：
 * 高島屋這類通路有給回饋，直接用他們的標價賣就有利潤；
 * 但 Uniqlo / GU 沒有回饋，照抄他們的價格等於做白工，必須自己加價。
 * 所以加價規則是「依來源網站」設定的，匯入時自動套用，個別商品仍可覆寫。
 *
 * 特價商品會把加價同時套在原價與特價上，
 * 這樣前台顯示的「省 ¥XXX」才會跟實際折扣幅度一致，不會誤導客人。
 */

/** 預設規則：高島屋有回饋所以不加價，其他來源預設加 30%。 */
const DEFAULT_PRICING = {
  rules: {
    UNIQLO: { type: "percent", value: 30 },
    GU: { type: "percent", value: 30 },
    "takashimaya.co.jp": { type: "none", value: 0 },
    default: { type: "percent", value: 30 },
  },
  // 進位方式：算完之後往上取整，價格才不會出現 ¥1,237 這種零頭
  rounding: "10", // "none" | "10" | "100"
};

/**
 * 找出某個來源網站該用哪條規則。
 * source_site 可能是 "UNIQLO"、"GU"，也可能是 "www.takashimaya.co.jp" 這種網域，
 * 所以先找完全相符，再找包含關係，都沒有才用 default。
 */
function ruleFor(sourceSite, pricing) {
  const cfg = pricing || DEFAULT_PRICING;
  const rules = cfg.rules || {};
  const site = String(sourceSite || "").trim();

  if (site && rules[site]) return rules[site];
  const key = Object.keys(rules).find(
    (k) => k !== "default" && site && site.toLowerCase().includes(k.toLowerCase())
  );
  if (key) return rules[key];
  return rules.default || { type: "none", value: 0 };
}

/** 往上取整到最接近的 10 或 100 元，讓標價好看一點。 */
function roundPrice(value, mode) {
  if (value == null || !isFinite(value)) return null;
  const n = Math.max(0, value);
  if (mode === "100") return Math.ceil(n / 100) * 100;
  if (mode === "10") return Math.ceil(n / 10) * 10;
  return Math.round(n);
}

/** 把一個來源價套上加價規則。 */
function applyMarkup(cost, rule, rounding) {
  if (cost == null || !isFinite(cost)) return null;
  const r = rule || { type: "none", value: 0 };
  const value = Number(r.value) || 0;

  let out = cost;
  if (r.type === "percent") out = cost * (1 + value / 100);
  else if (r.type === "fixed") out = cost + value;

  return roundPrice(out, rounding);
}

/**
 * 依商品的來源價與加價設定，算出售價與（有特價時的）原價。
 *
 * product 需要有 cost_jpy；cost_original_jpy 只有特價商品才會有。
 * 商品自己有 markup_type 就以它為準（後台手動調過的個別商品），
 * 否則用該來源網站的預設規則。
 */
function computePrices(product, pricing) {
  // 不能直接 Number(product.cost_jpy)：JS 的 Number(null) 是 0，不是 NaN，
  // 抓不到成本時（書籤工具沒抓到價格）cost_jpy 會被存成 null，這裡如果
  // 沒特別處理，null 會被誤當成「成本 ¥0」，算出一個看起來正常、實際上
  // 完全錯誤的售價 ¥0（賣家實測 P-Bandai 商品時真的發生過這個狀況）。
  const cost = product.cost_jpy == null ? null : Number(product.cost_jpy);
  const costOriginal = Number(product.cost_original_jpy) || null;

  const rule = product.markup_type
    ? { type: product.markup_type, value: Number(product.markup_value) || 0 }
    : ruleFor(product.source_site, pricing);

  const rounding = (pricing || DEFAULT_PRICING).rounding;

  return {
    price_jpy: applyMarkup(cost, rule, rounding),
    price_original_jpy: costOriginal ? applyMarkup(costOriginal, rule, rounding) : null,
    markup_applied: rule,
  };
}

/** 給後台顯示用：這筆賺多少、幾成。 */
function profitOf(product) {
  const cost = Number(product.cost_jpy);
  const price = Number(product.price_jpy);
  if (!cost || !price) return null;
  return {
    amount: price - cost,
    percent: Math.round(((price - cost) / cost) * 1000) / 10,
  };
}

module.exports = { DEFAULT_PRICING, ruleFor, roundPrice, applyMarkup, computePrices, profitOf };
