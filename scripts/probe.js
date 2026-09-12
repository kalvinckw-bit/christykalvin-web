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

/**
 * 手動追蹤 redirect 鏈路（不讓 fetch 自動跟隨），把每一跳的狀態碼、
 * Location、Set-Cookie 都印出來——用來判斷「導去選地區頁」到底是
 * 3xx Location 導向（可能靠 GeoIP，換不了 IP 就繞不過去），
 * 還是純粹靠 cookie 判斷（那補一個 cookie 就能繞過去，不用整個機房 IP 都換掉）。
 */
async function probeRedirectChain(url, maxHops = 6) {
  const jar = [];
  let current = url;
  for (let hop = 0; hop < maxHops; hop++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        "Accept-Language": "ja,zh-TW;q=0.8,en;q=0.5",
        ...(jar.length ? { Cookie: jar.join("; ") } : {}),
      },
    });
    const setCookie =
      typeof res.headers.getSetCookie === "function"
        ? res.headers.getSetCookie()
        : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
    setCookie.forEach((c) => jar.push(c.split(";")[0]));
    const location = res.headers.get("location");
    console.log(`  [hop ${hop}] ${current}`);
    console.log(`            HTTP ${res.status}${location ? `  → Location: ${location}` : ""}`);
    if (setCookie.length) setCookie.forEach((c) => console.log(`            Set-Cookie: ${truncate(c, 160)}`));
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    return { finalUrl: current, finalStatus: res.status, cookies: jar, body: await res.text() };
  }
  return { finalUrl: current, finalStatus: null, cookies: jar, body: "" };
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
 * 賣家問「能不能自動選日本」——redirect 鏈路已經證實是 GeoIP 判斷、沒有
 * cookie 可補，但還沒排除的是：對方伺服器會不會誤信客戶端自己宣稱的
 * 位置表頭（常見設定錯誤：CDN 後面的 origin 誤把 client 送來的表頭當成
 * CDN 自己加的地理位置判斷依據）。這裡試幾組常見的 CDN/GeoIP 表頭，
 * 一組合法的日本 IP（東京大學的公開網段 133.11.0.0/16，只是拿來當「看起來像日本」
 * 的樣本值，不是真的連線過去），看 origin 會不會被唬過去直接放行。
 */
async function probeHeaderSpoof(url) {
  section("嘗試偽造地區／IP 表頭，看伺服器是否誤信客戶端自報位置（常見設定漏洞測試）");
  const jpIp = "133.11.238.1";
  const variants = [
    { "CF-IPCountry": "JP" },
    { "X-Country-Code": "JP" },
    { "X-Vercel-IP-Country": "JP" },
    { "Fastly-Geo-Country": "JP" },
    { "X-Forwarded-For": jpIp },
    { "X-Real-IP": jpIp },
    { "True-Client-IP": jpIp },
    { "X-Forwarded-For": jpIp, "CF-IPCountry": "JP", "X-Real-IP": jpIp, "True-Client-IP": jpIp, "X-Country-Code": "JP" },
  ];
  for (const extra of variants) {
    try {
      const res = await fetch(url, {
        redirect: "manual",
        headers: { "User-Agent": UA, "Accept-Language": "ja,zh-TW;q=0.8,en;q=0.5", ...extra },
      });
      const loc = res.headers.get("location");
      const label = Object.entries(extra).map(([k, v]) => `${k}:${v}`).join(", ");
      console.log(`  [${label}]`);
      console.log(`    → HTTP ${res.status}${loc ? `  Location: ${loc}` : "  （沒有轉址，可能繞過去了！）"}`);
    } catch (e) {
      console.log(`  失敗：${e.message}`);
    }
  }
}

/** 同一個網站常見還有行動版/其他子網域，導向規則可能不一樣，順便都試一次 */
async function probeAltHosts(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return;
  }
  const alts = ["www", "m", "sp", "mobile"].map((sub) => {
    const host = u.hostname.replace(/^(www|m|sp|mobile)\./, "");
    return `${u.protocol}//${sub}.${host}${u.pathname}${u.search}`;
  });
  section("嘗試其他子網域（行動版等導向規則可能不同）");
  for (const alt of alts) {
    try {
      const res = await fetch(alt, {
        redirect: "manual",
        headers: { "User-Agent": UA, "Accept-Language": "ja,zh-TW;q=0.8,en;q=0.5" },
      });
      const loc = res.headers.get("location");
      console.log(`  ${alt}`);
      console.log(`    → HTTP ${res.status}${loc ? `  Location: ${loc}` : ""}`);
    } catch (e) {
      console.log(`  ${alt} → 失敗：${e.message}`);
    }
  }
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
    l2s: `${base}/products/${productId}/price-groups/${priceGroup}/l2s?withPrices=true&withStocks=true&includePreviousPrice=true&httpFailure=true`,
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
      for (const key of ["name", "productId", "representative", "prices", "promotion", "genderName",
                         "images", "colors", "sizes", "longDescription", "designDetail", "curationIds"]) {
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

  if (finalUrl !== url) {
    section("Redirect 鏈路追蹤（判斷導向是靠 GeoIP 還是 Cookie）");
    const chain = await probeRedirectChain(url);
    if (chain.cookies.length) {
      console.log("  → 過程中有 Set-Cookie，值得試試看帶著這些 cookie 直接打原始網址一次。");
    } else {
      console.log("  → 全程沒有 Set-Cookie，導向很可能是純 GeoIP／IP 位置判斷，換 cookie 沒用。");
    }
    // 找看看落地頁裡有沒有「選日本／JP」的連結，供人工確認導向機制
    const jpLinkMatches = chain.body.match(/<a[^>]+href=["']([^"']*)["'][^>]*>[^<]{0,40}(日本|JP|Japan)[^<]{0,10}<\/a>/gi);
    if (jpLinkMatches) {
      console.log("  落地頁裡疑似「選日本」的連結：");
      jpLinkMatches.slice(0, 5).forEach((m) => console.log("   ", truncate(m, 200)));
    } else {
      console.log("  落地頁裡沒找到明顯的「選日本」連結。");
    }

    await probeHeaderSpoof(url);
    await probeAltHosts(url);
  }

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

  // 賣家問「其他顏色抓不到嗎」——查一下顏色選擇區塊在 HTML 裡長什麼樣子，
  // 才知道其他顏色是連去別的網址、還是同一頁用 JS 切換、還是根本沒有結構化資訊。
  section("顏色/尺寸選擇區塊（找「カラー」「サイズ」附近的 HTML，看其他顏色是不是連到別的網址）");
  const colorIdx = body.search(/カラー選択|カラー：|色選択/);
  if (colorIdx === -1) {
    console.log("（沒找到「カラー選択」這類文字，可能是圖片裡的文字或用別的詞）");
  } else {
    console.log(truncate(body.slice(colorIdx, colorIdx + 1500), 1500));
  }

  // extract.js 目前只認 og:image / twitter:image / itemprop=image 這幾種 meta 來源，
  // 有些活動頁（例如 premico 這類預購 LP 頁）真正的商品圖是內文裡的 <img> 標籤，
  // 沒有走 meta，所以現有解析抓不到——先列出來看看有沒有漏掉的圖，再決定要不要
  // 針對這個網站加專用規則，而不是憑猜測改。
  section("頁面內所有 <img> 標籤（找 og:image 之外、藏在內文裡的商品圖）");
  const imgs = body.match(/<img[^>]+>/gi) || [];
  if (!imgs.length) console.log("（沒有找到）");
  imgs.slice(0, 30).forEach((t) => console.log(" ", truncate(t, 220)));

  await probeFastRetailing(finalUrl);
}

main().catch((e) => {
  console.error("偵測失敗：", e.message);
  process.exit(1);
});
