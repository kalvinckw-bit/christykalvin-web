/**
 * PREMICO（iei.jp）解析器測試（不需網路）：
 *   cd functions && node premico.test.js
 *
 * 測試用的 HTML 片段是 2026-09-10 用 scripts/probe.js 實際抓回來的
 * iei.jp/51638/ 頁面結構節錄，不是憑空捏造的。
 */

const assert = require("assert");
const { isPremicoUrl, parsePremicoHtml } = require("./premico");

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

console.log("isPremicoUrl");
test("認得 iei.jp 網址", () => {
  assert.strictEqual(isPremicoUrl("https://iei.jp/51638/"), true);
});
test("其他網站回傳 false，走通用解析器", () => {
  assert.strictEqual(isPremicoUrl("https://www.uniqlo.com/jp/ja/products/E483535-000/00"), false);
});

console.log("parsePremicoHtml");
// 節錄自實際頁面：分期金額、一括價格（稅前/稅後）、運費（稅前/稅後）、商品照片
const SAMPLE_HTML = `
<html><body>
  <img src="/premico/images/head_tel.jpg" alt="お電話でのお問い合わせ">
  <img src="/premico/images/logo.jpg" alt="PREMICO">
  <img src="/premico/lp/51638/sp_keyvisual.jpg" alt="ONE PIECE新幹線ウオッチ せとうちブルー号モデル">
  <img src="/premico/lp/51638/sp_lead.jpg" alt="冒険の青に夢をのせて">
  <img src="/premico/lp/51638/gallery_01_l.jpg" alt="">
  <img src="/premico/lp/51638/gallery_01.jpg" alt="">
  <img src="/premico/lp/51638/gallery_02.jpg" alt="">
  <img src="/premico/lp/51638/gallery_03.jpg" alt="">
  <img src="/premico/lp/51638/gallery_04.jpg" alt="">
  <img src="/premico/lp/51638/price_img.jpg" alt="">
  <img src="/premico/images/copyright.gif" alt="Copyright">
  <p>月々6,100円（税込6,710円）×12回払い</p>
  <p>一括価格 69,800円（税込76,780円）</p>
  <p>発送手数料 700円（税込770円）</p>
</body></html>
`;

test("成本 = 一括價格（稅込）+ 運費（稅込），不是抓到分期金額 6,100", () => {
  const r = parsePremicoHtml(SAMPLE_HTML, "https://iei.jp/51638/");
  assert.strictEqual(r.price_jpy, 77550, "76,780 + 770 才是實際成本");
  assert.strictEqual(r.shipping_fee_jpy, 770);
});

test("只挑 gallery_XX／sp_keyvisual 這兩種商品照片，logo/電話按鈕/版權圖不算", () => {
  const r = parsePremicoHtml(SAMPLE_HTML, "https://iei.jp/51638/");
  assert.strictEqual(r.images.length, 6, "keyvisual + 5 張 gallery（gallery_01_l 跟 gallery_01 是兩個不同網址）");
  assert.ok(r.images.every((u) => u.startsWith("https://iei.jp/")), "相對路徑要轉成絕對網址");
  assert.ok(r.images.some((u) => u.endsWith("sp_keyvisual.jpg")));
  assert.ok(r.images.some((u) => u.endsWith("gallery_04.jpg")));
  assert.ok(!r.images.some((u) => u.includes("price_img")), "price_img 是價格區塊的排版圖，不是商品照");
  assert.ok(!r.images.some((u) => u.includes("logo")), "logo 不是商品照");
});

test("找不到一括價格就回傳 null，不會亂猜一個數字", () => {
  const r = parsePremicoHtml("<html><body>沒有價格資訊</body></html>", "https://iei.jp/99999/");
  assert.strictEqual(r.price_jpy, null);
  assert.deepStrictEqual(r.images, []);
});

console.log(`\n${passed} 項測試通過${process.exitCode ? "，有測試失敗" : ""}`);
