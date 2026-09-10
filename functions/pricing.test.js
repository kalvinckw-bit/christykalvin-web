/**
 * 售價計算測試（不需網路）：
 *   cd functions && node pricing.test.js
 */

const assert = require("assert");
const { DEFAULT_PRICING, ruleFor, roundPrice, applyMarkup, computePrices, profitOf } = require("./pricing");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("ruleFor — 依來源網站挑規則");
test("Uniqlo / GU 用各自的規則", () => {
  assert.deepStrictEqual(ruleFor("UNIQLO", DEFAULT_PRICING), { type: "percent", value: 30 });
  assert.deepStrictEqual(ruleFor("GU", DEFAULT_PRICING), { type: "percent", value: 30 });
});

test("高島屋有回饋，預設不加價", () => {
  const r = ruleFor("www.takashimaya.co.jp", DEFAULT_PRICING);
  assert.strictEqual(r.type, "none", "網域含 takashimaya.co.jp 就該套用不加價規則");
});

test("沒設定過的來源用 default 規則", () => {
  assert.deepStrictEqual(ruleFor("some-random-shop.jp", DEFAULT_PRICING), { type: "percent", value: 30 });
  assert.deepStrictEqual(ruleFor("", DEFAULT_PRICING), { type: "percent", value: 30 });
});

console.log("roundPrice — 標價進位");
test("往上取整到 10 元", () => {
  assert.strictEqual(roundPrice(1237, "10"), 1240);
  assert.strictEqual(roundPrice(1240, "10"), 1240, "剛好整十不該再往上跳");
});

test("往上取整到 100 元", () => {
  assert.strictEqual(roundPrice(1237, "100"), 1300);
  assert.strictEqual(roundPrice(1200, "100"), 1200);
});

test("不進位就照原數字", () => {
  assert.strictEqual(roundPrice(1237, "none"), 1237);
});

console.log("applyMarkup — 加價");
test("加百分比", () => {
  assert.strictEqual(applyMarkup(1000, { type: "percent", value: 25 }, "10"), 1250);
  assert.strictEqual(applyMarkup(990, { type: "percent", value: 25 }, "10"), 1240, "990×1.25=1237.5 → 進位 1240");
});

test("加固定金額", () => {
  assert.strictEqual(applyMarkup(1990, { type: "fixed", value: 500 }, "10"), 2490);
});

test("不加價就原價賣（高島屋這種有回饋的）", () => {
  assert.strictEqual(applyMarkup(3240, { type: "none", value: 0 }, "10"), 3240);
});

test("沒有來源價時回傳 null，不會算出 NaN 掛在網站上", () => {
  assert.strictEqual(applyMarkup(null, { type: "percent", value: 25 }, "10"), null);
  assert.strictEqual(applyMarkup(undefined, { type: "percent", value: 25 }, "10"), null);
});

console.log("computePrices — 實際商品情境");
test("Uniqlo 特價商品：原價與特價都套同一個加價", () => {
  // 來源：原價 1500、特價 990
  const r = computePrices(
    { cost_jpy: 990, cost_original_jpy: 1500, source_site: "UNIQLO" },
    DEFAULT_PRICING
  );
  assert.strictEqual(r.price_jpy, 1290, "990 加 30% 進位到 1290");
  assert.strictEqual(r.price_original_jpy, 1950, "1500 加 30% 進位到 1950");
  assert.ok(r.price_original_jpy > r.price_jpy, "原價必須高於售價，前台刪除線才成立");
});

test("高島屋商品：照抓不加價", () => {
  const r = computePrices({ cost_jpy: 3240, source_site: "www.takashimaya.co.jp" }, DEFAULT_PRICING);
  assert.strictEqual(r.price_jpy, 3240);
  assert.strictEqual(r.price_original_jpy, null, "沒特價就不該生出原價");
});

test("個別商品自己設定的加價，優先於來源網站的預設", () => {
  const r = computePrices(
    { cost_jpy: 1000, source_site: "UNIQLO", markup_type: "fixed", markup_value: 800 },
    DEFAULT_PRICING
  );
  assert.strictEqual(r.price_jpy, 1800, "應該用商品自己的 +¥800，不是來源預設的 30%");
});

test("加價設定改成 30% 後，算出來的價格跟著變", () => {
  const custom = { rules: { UNIQLO: { type: "percent", value: 30 } }, rounding: "10" };
  const r = computePrices({ cost_jpy: 1000, source_site: "UNIQLO" }, custom);
  assert.strictEqual(r.price_jpy, 1300);
});

console.log("profitOf — 後台顯示利潤");
test("算得出賺多少錢與幾成", () => {
  const p = profitOf({ cost_jpy: 990, price_jpy: 1240 });
  assert.strictEqual(p.amount, 250);
  assert.strictEqual(p.percent, 25.3);
});

test("資料不全時回傳 null，不會在後台顯示奇怪數字", () => {
  assert.strictEqual(profitOf({ cost_jpy: 0, price_jpy: 1240 }), null);
  assert.strictEqual(profitOf({ price_jpy: 1240 }), null);
});

console.log(`\n${passed} 項測試通過${process.exitCode ? "，有測試失敗" : ""}`);
