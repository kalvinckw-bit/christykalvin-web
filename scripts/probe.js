#!/usr/bin/env node
/**
 * 商品頁偵測工具：抓一個商品網址回來，report 它的資料藏在哪裡。
 *
 *   node scripts/probe.js "<商品網址>"
 *
 * 開發用的雲端 sandbox 連不到大部分外部網站，所以實際執行是透過
 * .github/workflows/probe-url.yml（GitHub Actions 網路沒有限制）。
 * 用途是在為新網站寫解析規則之前，先看清楚對方頁面的真實結構，
 * 而不是憑猜測改 extract.js。
 */

const { extractFromHtml } = require("../functions/extract");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function section(title) {
  console.log(`\n${"=".repeat(60)}\n${title}\n${"=".repeat(60)}`);
}

function truncate(s, n = 300) {
  s = String(s ?? "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, "Accept-Language": "ja,zh-TW;q=0.8,en;q=0.5" },
  });
  return { status: res.status, url: res.url, body: await res.text() };
}

/** 找出頁面裡所有 JSON-LD 區塊 */
function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      out.push({ __parseError: truncate(m[1], 120) });
    }
  }
  return out;
}

/** 這頁是不是靠 JS 才把資料畫出來 */
function spaSignals(html) {
  const signals = [
    ["__NEXT_DATA__", /__NEXT_DATA__/],
    ["__NUXT__", /__NUXT__/],
    ["__PRELOADED_STATE__", /__PRELOADED_STATE__/],
    ["window.__INITIAL", /window\.__INITIAL/],
    ["react-root / data-reactroot", /data-reactroot|id="root"/],
  ];
  return signals.filter(([, re]) => re.test(html)).map(([name]) => name);
}

/** 價格相關的文字線索（含期間限定價這種折扣寫法） */
function priceSignals(html) {
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
  const pats = {
    "¥ 金額": /¥\s?[0-9][0-9,]{2,}/g,
    "○○円": /[0-9][0-9,]{2,}\s?円/g,
    "期間限定価格": /期間限定価格/g,
    "セール/SALE": /セール|SALE/g,
    "税込": /税込/g,
    "まで(截止)": /[0-9]{1,2}\s?月\s?[0-9]{1,2}\s?日\s?まで|～[0-9]{1,2}\/[0-9]{1,2}/g,
  };
  const out = {};
  for (const [name, re] of Object.entries(pats)) {
    const hits = text.match(re);
    if (hits) out[name] = [...new Set(hits)].slice(0, 6);
  }
  return out;
}

/** 頁面裡有沒有內嵌 JSON 提到 price / stock，順便找出可能的 API 端點 */
function embeddedApiHints(html) {
  const apis = new Set();
  const re = /["'](\/[a-z0-9/_\-.]*api[a-z0-9/_\-.]*)["']/gi;
  let m;
  while ((m = re.exec(html)) && apis.size < 15) apis.add(m[1]);
  const hasPriceJson = /"(price|prices|basePrice|promoPrice)"\s*:/i.test(html);
  return { apis: [...apis], hasPriceJson };
}

/**
 * Uniqlo 與 GU 是同一個母公司（Fast Retailing）的同一套電商系統，
 * 商品頁是 React SPA，價格不在 HTML 裡，要打他們的 commerce API 才拿得到。
 * 網址長這樣：https://www.uniqlo.com/jp/ja/products/E483535-000/00?...
 */
function fastRetailingApi(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/(uniqlo\.com|gu-global\.com)$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/([a-z]{2})\/([a-z]{2})\/products\/([A-Z0-9-]+)(?:\/(\d+))?/i);
  if (!m) return null;
  const [, region, lang, productId, priceGroup = "00"] = m;
  const base = `${u.origin}/${region}/api/commerce/v5/${lang}`;
  return {
    productId,
    priceGroup,
    detail: `${base}/products/${productId}?includeModelSize=true&httpFailure=true`,
    l2s: `${base}/products/${productId}/price-groups/${priceGroup}/l2s?withPrices=true&withStocks=true&includePreviousPrice=false&httpFailure=true`,
  };
}

async function probeFastRetailing(url) {
  const api = fastRetailingApi(url);
  if (!api) return;

  section("Uniqlo / GU 專用 API（Fast Retailing 平台）");
  console.log("  商品編號:", api.productId, " 價格群組:", api.priceGroup);

  for (const [label, endpoint] of [["商品主資料", api.detail], ["尺寸/顏色/價格/庫存", api.l2s]]) {
    console.log(`\n  ── ${label}\n     ${endpoint}`);
    try {
      const res = await fetch(endpoint, {
        headers: { "User-Agent": UA, Accept: "application/json" },
      });
      const text = await res.text();
      console.log(`     HTTP ${res.status}, ${text.length.toLocaleString()} 字元`);
      if (!res.ok) {
        console.log("     ", truncate(text, 300));
        continue;
      }
      const json = JSON.parse(text);
      const result = json.result || json;
      console.log("     頂層欄位:", Object.keys(result).join(", "));

      // 商品主資料：名稱、價格、促銷文字
      for (const key of ["name", "productId", "representative", "prices", "promotion", "genderName"]) {
        if (result[key] !== undefined) {
          console.log(`     ${key}:`, truncate(JSON.stringify(result[key]), 400));
        }
      }
      // l2s：每個尺寸/顏色組合的價格與庫存
      for (const key of ["l2s", "prices", "stocks", "summary"]) {
        const v = result[key];
        if (v === undefined) continue;
        if (Array.isArray(v)) {
          console.log(`     ${key}: 陣列 ${v.length} 筆，第一筆 =`, truncate(JSON.stringify(v[0]), 500));
        } else if (v && typeof v === "object") {
          const ks = Object.keys(v);
          console.log(`     ${key}: 物件 ${ks.length} 個 key，第一筆 =`,
            truncate(JSON.stringify({ [ks[0]]: v[ks[0]] }), 500));
        }
      }
    } catch (e) {
      console.log("     失敗：", e.message);
    }
  }
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("用法：node scripts/probe.js <商品網址>");
    process.exit(1);
  }

  section(`抓取：${url}`);
  const { status, url: finalUrl, body } = await fetchText(url);
  console.log(`HTTP ${status}`);
  console.log(`最終網址 ${finalUrl}`);
  console.log(`HTML 長度 ${body.length.toLocaleString()} 字元`);

  section("og: meta 標籤");
  const ogs = body.match(/<meta[^>]+(property|name)=["'](og:|twitter:|product:)[^>]*>/gi) || [];
  if (!ogs.length) console.log("（沒有找到）");
  ogs.slice(0, 20).forEach((t) => console.log(" ", truncate(t, 200)));

  section("JSON-LD 結構化資料");
  const lds = jsonLdBlocks(body);
  if (!lds.length) console.log("（沒有找到）");
  lds.forEach((ld, i) => {
    const types = JSON.stringify(ld["@type"] || (ld["@graph"] || []).map((g) => g["@type"]));
    console.log(`  [${i}] @type=${types}`);
    console.log(`      ${truncate(JSON.stringify(ld), 600)}`);
  });

  section("目前 extract.js 抓到什麼");
  const r = extractFromHtml(body, finalUrl);
  console.log("  title   :", truncate(r.title, 120) || "(空)");
  console.log("  price   :", r.price, r.currency || "");
  console.log("  images  :", r.images.length, "張");
  r.images.slice(0, 3).forEach((u) => console.log("           ", u));
  console.log("  desc    :", truncate(r.description, 160) || "(空)");
  console.log("  specText:", truncate(r.specText, 200) || "(空)");

  section("價格線索（含折扣/期間限定）");
  const ps = priceSignals(body);
  if (!Object.keys(ps).length) console.log("（HTML 裡找不到任何價格文字，代表價格是 JS 載入的）");
  for (const [k, v] of Object.entries(ps)) console.log(` ${k}:`, v.join(" , "));

  section("是不是 JS 動態渲染 / API 端點");
  const spa = spaSignals(body);
  console.log("  SPA 特徵:", spa.length ? spa.join(", ") : "（沒有明顯特徵）");
  const { apis, hasPriceJson } = embeddedApiHints(body);
  console.log("  HTML 內含 price JSON:", hasPriceJson ? "有" : "沒有");
  console.log("  可能的 API 路徑:");
  apis.forEach((a) => console.log("   ", a));

  await probeFastRetailing(finalUrl);
}

main().catch((e) => {
  console.error("偵測失敗：", e.message);
  process.exit(1);
});
