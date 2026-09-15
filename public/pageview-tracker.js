/**
 * CK Japan Select - 前台訪客瀏覽記錄收集器
 * 記錄整頁瀏覽（type:"page"）與商品詳情瀏覽（type:"product"），
 * 寫進 Firestore 的 pageviews collection，供賣家在後台看流量與熱門商品。
 * 訪客不用登入即可寫入（規則只開放 create，讀取要後台登入帳號），
 * 失敗一律吞掉不拋錯，避免影響正常瀏覽/下單流程。
 */
function getSessionId(){
  try {
    let id = localStorage.getItem("ck_session_id");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2)));
      localStorage.setItem("ck_session_id", id);
    }
    return id;
  } catch (_) {
    return "no-storage";
  }
}

export async function logPageView(db, addDoc, collection, extra){
  try {
    const nav = window.navigator || {};
    const scr = window.screen || {};
    const ua = nav.userAgent || "";

    const view = {
      type: extra.type,
      product_id: extra.product_id || null,
      product_title: extra.product_title || null,
      session_id: getSessionId(),
      collected_at: new Date().toISOString(),
      timestamp: Date.now(),
      site: window.location.hostname,
      url: window.location.href,
      referrer: document.referrer || "direct",

      user_agent: ua,
      platform: nav.platform || (nav.userAgentData ? nav.userAgentData.platform : "unknown"),
      is_mobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua),
      device_type: /iPad|Tablet/i.test(ua) ? "tablet" : (/Mobile|Android|iPhone/i.test(ua) ? "mobile" : "desktop"),

      screen_resolution: `${scr.width || 0}x${scr.height || 0}`,
      viewport_size: `${window.innerWidth || 0}x${window.innerHeight || 0}`,
      color_depth: scr.colorDepth || 0,
      pixel_ratio: window.devicePixelRatio || 1,

      cpu_cores: nav.hardwareConcurrency || null,
      device_memory_gb: nav.deviceMemory || null,
      max_touch_points: nav.maxTouchPoints || 0,

      language: nav.language || "",
      languages_preferred: nav.languages ? Array.from(nav.languages) : [],
      timezone: (typeof Intl !== "undefined" && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
      timezone_offset_minutes: new Date().getTimezoneOffset(),
      dark_mode: window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)").matches : false,

      connection_type: (nav.connection && (nav.connection.effectiveType || nav.connection.type)) || "unknown",
      downlink_mbps: (nav.connection && nav.connection.downlink) || null,
      rtt_ms: (nav.connection && nav.connection.rtt) || null,
      cookies_enabled: !!nav.cookieEnabled
    };

    try {
      const ipResp = await fetch("https://freeipapi.com/api/json");
      if (ipResp.ok) {
        const ipData = await ipResp.json();
        view.ip = ipData.ipAddress || null;
        view.geo_country = ipData.countryName || null;
        view.geo_country_code = ipData.countryCode || null;
        view.geo_city = ipData.cityName || null;
        view.geo_region = ipData.regionName || null;
        view.geo_latitude = ipData.latitude || null;
        view.geo_longitude = ipData.longitude || null;
      }
    } catch (_) {
      try {
        const fbResp = await fetch("https://api.ipify.org?format=json");
        if (fbResp.ok) {
          const fbData = await fbResp.json();
          view.ip = fbData.ip || null;
        }
      } catch (_) {}
    }

    await addDoc(collection(db, "pageviews"), view);
  } catch (err) {
    console.warn("[CK pageview] 記錄失敗（不影響瀏覽）：", err);
  }
}
