/**
 * 商品頁面解析器測試（不需網路、不需部署）：
 *   cd functions && node extract.test.js
 */

const assert = require("assert");
const { absoluteUrl, extractFromHtml } = require("./extract");

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

console.log("absoluteUrl");
test("相對路徑轉絕對網址", () => {
  assert.strictEqual(
    absoluteUrl("/img/item.jpg", "https://www.takashimaya.co.jp/shop/item/123.html"),
    "https://www.takashimaya.co.jp/img/item.jpg"
  );
});
test("protocol-relative 網址補上 https", () => {
  assert.strictEqual(
    absoluteUrl("//cdn.example.jp/a.jpg", "https://shop.example.jp/item/1"),
    "https://cdn.example.jp/a.jpg"
  );
});
test("絕對網址保持不變", () => {
  assert.strictEqual(
    absoluteUrl("https://cdn.example.jp/a.jpg", "https://shop.example.jp/item/1"),
    "https://cdn.example.jp/a.jpg"
  );
});
test("data: URI 與空值一律略過", () => {
  assert.strictEqual(absoluteUrl("data:image/png;base64,AAA", "https://a.jp/"), null);
  assert.strictEqual(absoluteUrl("", "https://a.jp/"), null);
  assert.strictEqual(absoluteUrl(null, "https://a.jp/"), null);
});

console.log("extractFromHtml — og:meta 型商品頁");
test("抓到標題、描述、圖片、價格", () => {
  const html = `<html><head>
    <meta property="og:title" content="ルイ・ヴィトン モノグラム トートバッグ">
    <meta property="og:description" content="新品未使用。サイズ 30x25x15cm。">
    <meta property="og:image" content="/images/item_main.jpg">
    <meta property="og:image" content="//cdn.example.jp/images/item_sub.jpg">
    <meta property="product:price:amount" content="128000">
    <meta property="product:price:currency" content="JPY">
  </head><body></body></html>`;
  const r = extractFromHtml(html, "https://www.takashimaya.co.jp/shop/item/999.html");
  assert.strictEqual(r.title, "ルイ・ヴィトン モノグラム トートバッグ");
  assert.match(r.description, /新品未使用/);
  assert.deepStrictEqual(r.images, [
    "https://www.takashimaya.co.jp/images/item_main.jpg",
    "https://cdn.example.jp/images/item_sub.jpg",
  ]);
  assert.strictEqual(r.price, 128000);
  assert.strictEqual(r.currency, "JPY");
});

console.log("extractFromHtml — JSON-LD 型商品頁");
test("從 schema.org Product 取得資料", () => {
  const html = `<html><head><title>店名</title>
    <script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "セイコー プレザージュ 自動巻き",
      description: "国内正規品。ケース径 40.5mm。",
      image: ["https://cdn.example.jp/seiko1.jpg", "/seiko2.jpg"],
      offers: { "@type": "Offer", price: "78000", priceCurrency: "JPY" },
    })}</script>
  </head><body></body></html>`;
  const r = extractFromHtml(html, "https://shop.example.jp/item/seiko");
  assert.strictEqual(r.title, "セイコー プレザージュ 自動巻き", "JSON-LD 商品名應優先於網頁 <title>");
  assert.match(r.description, /国内正規品/);
  assert.deepStrictEqual(r.images, [
    "https://cdn.example.jp/seiko1.jpg",
    "https://shop.example.jp/seiko2.jpg",
  ]);
  assert.strictEqual(r.price, 78000);
});

test("JSON-LD 放在 @graph 裡也讀得到", () => {
  const html = `<html><head>
    <script type="application/ld+json">${JSON.stringify({
      "@graph": [
        { "@type": "WebSite", name: "サイト" },
        {
          "@type": ["Product"],
          name: "商品名",
          image: "https://cdn.example.jp/g.jpg",
          offers: { price: 4980, priceCurrency: "JPY" },
        },
      ],
    })}</script>
  </head><body></body></html>`;
  const r = extractFromHtml(html, "https://shop.example.jp/i/1");
  assert.strictEqual(r.title, "商品名");
  assert.strictEqual(r.price, 4980);
});

console.log("extractFromHtml — 容錯");
test("價格只出現在內文的 ¥12,800 也抓得到", () => {
  const html = `<html><head><meta property="og:title" content="商品">
    <meta property="og:image" content="https://cdn.example.jp/a.jpg"></head>
    <body><div class="price">¥12,800 (税込)</div></body></html>`;
  const r = extractFromHtml(html, "https://shop.example.jp/i/1");
  assert.strictEqual(r.price, 12800);
});

test("價格寫成「3,980円」也抓得到", () => {
  const html = `<html><head><meta property="og:title" content="商品">
    <meta property="og:image" content="https://cdn.example.jp/a.jpg"></head>
    <body><span>3,980円</span></body></html>`;
  const r = extractFromHtml(html, "https://shop.example.jp/i/1");
  assert.strictEqual(r.price, 3980);
});

test("壞掉的 JSON-LD 不會讓整個解析失敗", () => {
  const html = `<html><head>
    <meta property="og:title" content="商品">
    <meta property="og:image" content="https://cdn.example.jp/a.jpg">
    <script type="application/ld+json">{ 這不是合法 JSON }</script>
  </head><body></body></html>`;
  const r = extractFromHtml(html, "https://shop.example.jp/i/1");
  assert.strictEqual(r.title, "商品");
  assert.strictEqual(r.images.length, 1);
});

test("沒有任何圖片時回傳空陣列（由呼叫端提示改用手動上傳）", () => {
  const r = extractFromHtml("<html><head><title>x</title></head><body></body></html>", "https://a.jp/");
  assert.deepStrictEqual(r.images, []);
  assert.strictEqual(r.price, null);
});

console.log("extractFromHtml — specText（給 AI 抽規格用）");
test("specText 包含顏色/尺寸等規格內文", () => {
  const html = `<html><head><meta property="og:title" content="頭皮按摩器">
    <meta property="og:image" content="https://cdn.example.jp/a.jpg"></head>
    <body>
      <script>console.log("不應該出現在 specText 裡");</script>
      <style>.x{color:red}</style>
      <dl><dt>色</dt><dd>チャコールブラック／さくらピンク／ミストグレー</dd></dl>
      <dl><dt>商品番号</dt><dd>0002415762-001-1-08</dd></dl>
    </body></html>`;
  const r = extractFromHtml(html, "https://www.takashimaya.co.jp/shopping/product.html?p_cd=1");
  assert.match(r.specText, /チャコールブラック／さくらピンク／ミストグレー/);
  assert.match(r.specText, /0002415762-001-1-08/);
  assert.doesNotMatch(r.specText, /console\.log/);
});

test("重複的圖片網址會去重", () => {
  const html = `<html><head>
    <meta property="og:image" content="https://cdn.example.jp/a.jpg">
    <meta name="twitter:image" content="https://cdn.example.jp/a.jpg">
  </head><body></body></html>`;
  const r = extractFromHtml(html, "https://a.jp/");
  assert.deepStrictEqual(r.images, ["https://cdn.example.jp/a.jpg"]);
});

console.log(`\n${passed} 項測試通過${process.exitCode ? "，有測試失敗" : ""}`);
