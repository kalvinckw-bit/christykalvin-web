/**
 * Uniqlo / GU 解析器測試（不需網路）：
 *   cd functions && node fastretailing.test.js
 *
 * 測試資料是 2026-09-08 從他們正式 API 實際抓回來的結構，不是憑空捏造的。
 */

const assert = require("assert");
const { parseProductUrl, buildProduct, saleInfoFrom } = require("./fastretailing");

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

console.log("parseProductUrl");
test("認得 Uniqlo 商品網址", () => {
  const r = parseProductUrl(
    "https://www.uniqlo.com/jp/ja/products/E483535-000/00?colorDisplayCode=01&sizeDisplayCode=004"
  );
  assert.strictEqual(r.brand, "UNIQLO");
  assert.strictEqual(r.productId, "E483535-000");
  assert.strictEqual(r.priceGroup, "00");
  assert.strictEqual(r.goodsNo, "483535");
  assert.strictEqual(r.selectedColor, "01");
  assert.match(r.l2sUrl, /\/jp\/api\/commerce\/v5\/ja\/products\/E483535-000\/price-groups\/00\/l2s/);
});

test("認得 GU 商品網址（同一套系統）", () => {
  const r = parseProductUrl("https://www.gu-global.com/jp/ja/products/E361081-000/00");
  assert.strictEqual(r.brand, "GU");
  assert.strictEqual(r.goodsNo, "361081");
  assert.match(r.detailUrl, /gu-global\.com\/jp\/api\/commerce\/v5\/ja\/products\/E361081-000/);
});

test("其他網站回傳 null，走原本的通用解析器", () => {
  assert.strictEqual(parseProductUrl("https://www.takashimaya.co.jp/shopping/product.html?p_cd=1"), null);
  assert.strictEqual(parseProductUrl("not a url"), null);
});

console.log("saleInfoFrom — 期間限定價格");
test("抓得到限時折扣名稱與截止時間", () => {
  const r = saleInfoFrom([
    {
      flags: {
        priceFlags: [
          {
            code: "limitedOffer",
            name: "9/10まで期間限定価格",
            effectiveTime: { start: 1788454800, end: 1789059600 },
          },
        ],
      },
    },
  ]);
  assert.strictEqual(r.sale_label, "9/10まで期間限定価格");
  assert.strictEqual(r.sale_code, "limitedOffer");
  assert.strictEqual(r.sale_end_at, 1789059600 * 1000, "秒要換算成毫秒");
});

test("沒有折扣旗標時回傳空值，不會亂編一個截止日", () => {
  const r = saleInfoFrom([{ flags: { priceFlags: [] } }]);
  assert.strictEqual(r.sale_end_at, null);
  assert.strictEqual(r.sale_label, "");
});

console.log("buildProduct");

const info = parseProductUrl("https://www.uniqlo.com/jp/ja/products/E483535-000/00?colorDisplayCode=01");

const detailJson = {
  result: {
    name: "ミニT",
    longDescription: "- 1970年代から着想。<br>- フラットで薄いソール。",
    l2s: [
      { color: { displayCode: "01", name: "OFF WHITE" }, size: { displayCode: "002", name: "S" } },
      { color: { displayCode: "01", name: "OFF WHITE" }, size: { displayCode: "003", name: "M" } },
      { color: { displayCode: "09", name: "BLACK" }, size: { displayCode: "003", name: "M" } },
    ],
  },
};

const l2sJson = {
  result: {
    l2s: [
      {
        l2Id: "A1",
        color: { displayCode: "01" },
        size: { displayCode: "002" },
        flags: {
          priceFlags: [
            {
              code: "limitedOffer",
              name: "9/10まで期間限定価格",
              effectiveTime: { start: 1788454800, end: 1789059600 },
            },
          ],
        },
      },
      { l2Id: "A2", color: { displayCode: "01" }, size: { displayCode: "003" }, flags: {} },
      { l2Id: "A3", color: { displayCode: "09" }, size: { displayCode: "003" }, flags: {} },
    ],
    prices: {
      A1: { base: { value: 1500 }, promo: { value: 990 } },
      A2: { base: { value: 1500 }, promo: { value: 990 } },
      A3: { base: { value: 1500 }, promo: { value: 1500 } },
    },
    stocks: {
      A1: { statusCode: "IN_STOCK", quantity: 11 },
      A2: { statusCode: "STOCK_OUT", quantity: 0 },
      A3: { statusCode: "IN_STOCK", quantity: 3 },
    },
  },
};

test("售價取最低特價、原價取對應的定價", () => {
  const p = buildProduct(info, detailJson, l2sJson);
  assert.strictEqual(p.price_jpy, 990, "售價應該是特價 990");
  assert.strictEqual(p.price_original_jpy, 1500, "原價應該是 1500，前台才畫得出刪除線");
});

test("原價等於售價時不留原價，避免前台出現金額一樣的刪除線", () => {
  const noDiscount = JSON.parse(JSON.stringify(l2sJson));
  for (const k of Object.keys(noDiscount.result.prices)) {
    noDiscount.result.prices[k] = { base: { value: 990 }, promo: { value: 990 } };
  }
  const p = buildProduct(info, detailJson, noDiscount);
  assert.strictEqual(p.price_jpy, 990);
  assert.strictEqual(p.price_original_jpy, null);
});

test("帶出期間限定價格的名稱與截止時間", () => {
  const p = buildProduct(info, detailJson, l2sJson);
  assert.strictEqual(p.sale_label, "9/10まで期間限定価格");
  assert.strictEqual(p.sale_end_at, 1789059600 * 1000);
});

test("顏色與尺寸用得到的顯示名稱，不是內部代碼", () => {
  const p = buildProduct(info, detailJson, l2sJson);
  assert.deepStrictEqual(p.colors, ["OFF WHITE", "BLACK"]);
  assert.deepStrictEqual(p.sizes, ["S", "M"]);
});

test("每個顏色×尺寸都帶庫存狀態，缺貨的尺寸前台才擋得住", () => {
  const p = buildProduct(info, detailJson, l2sJson);
  assert.strictEqual(p.variants.length, 3);
  const soldOut = p.variants.find((v) => v.color === "OFF WHITE" && v.size === "M");
  assert.strictEqual(soldOut.in_stock, false, "M 號應該是缺貨");
  assert.strictEqual(soldOut.quantity, 0);
  const inStock = p.variants.find((v) => v.color === "BLACK");
  assert.strictEqual(inStock.in_stock, true);
});

test("商品說明的 <br> 換成換行、HTML 標籤清掉", () => {
  const p = buildProduct(info, detailJson, l2sJson);
  assert.ok(p.description.includes("\n"), "應該有換行");
  assert.ok(!p.description.includes("<br>"), "不該殘留 HTML 標籤");
});

test("抓不到圖片欄位時，用固定網址格式湊候選圖", () => {
  const p = buildProduct(info, detailJson, l2sJson);
  assert.ok(p.images.length > 0, "至少要有候選圖片");
  assert.ok(p.images[0].includes("483535"), "網址要帶到商品編號");
});

test("detail 有 images 欄位時優先用它", () => {
  const withImages = JSON.parse(JSON.stringify(detailJson));
  withImages.result.images = {
    main: { "01": [{ image: "https://image.uniqlo.com/UQ/a.jpg" }] },
    sub: [{ image: "https://image.uniqlo.com/UQ/b.jpg" }],
  };
  const p = buildProduct(info, withImages, l2sJson);
  assert.ok(p.images.includes("https://image.uniqlo.com/UQ/a.jpg"));
  assert.ok(p.images.includes("https://image.uniqlo.com/UQ/b.jpg"));
});

test("回傳品牌名稱與商品編號，方便後台辨識來源", () => {
  const p = buildProduct(info, detailJson, l2sJson);
  assert.strictEqual(p.source_site, "UNIQLO");
  assert.strictEqual(p.product_code, "E483535-000");
  assert.strictEqual(p.title, "ミニT");
});

console.log(`\n${passed} 項測試通過${process.exitCode ? "，有測試失敗" : ""}`);
