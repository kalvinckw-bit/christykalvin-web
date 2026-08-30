/**
 * CK Holdings Group - Global Client Telemetry & Device Fingerprint Collector
 * Collects full device, hardware, network, geo, and environment telemetry.
 */
export async function collectTelemetry(db, user, setDoc, doc) {
    if (!user || (!user.email && !user.uid)) return;
    try {
        const nav = typeof window !== 'undefined' ? window.navigator : {};
        const scr = typeof window !== 'undefined' ? window.screen : {};
        const userId = user.email || user.uid;

        const telemetry = {
            uid: user.uid || null,
            email: user.email || null,
            collected_at: new Date().toISOString(),
            timestamp: Date.now(),
            site: typeof window !== 'undefined' ? window.location.hostname : '',
            url: typeof window !== 'undefined' ? window.location.href : '',
            referrer: typeof document !== 'undefined' ? (document.referrer || 'direct') : '',
            
            // Device & OS
            user_agent: nav.userAgent || '',
            platform: nav.platform || (nav.userAgentData ? nav.userAgentData.platform : 'unknown'),
            is_mobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(nav.userAgent || ''),
            device_type: (/iPad|Tablet/i.test(nav.userAgent) ? 'tablet' : (/Mobile|Android|iPhone/i.test(nav.userAgent) ? 'mobile' : 'desktop')),
            
            // Screen & Display
            screen_resolution: ${scr.width || 0}x,
            screen_avail: ${scr.availWidth || 0}x,
            viewport_size: typeof window !== 'undefined' ? ${window.innerWidth || 0}x : '',
            color_depth: scr.colorDepth || 0,
            pixel_ratio: typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1,
            orientation: (scr.orientation && scr.orientation.type) ? scr.orientation.type : '',
            
            // Hardware Capability
            cpu_cores: nav.hardwareConcurrency || null,
            device_memory_gb: nav.deviceMemory || null,
            max_touch_points: nav.maxTouchPoints || 0,
            
            // Locale & Environment
            language: nav.language || '',
            languages_preferred: nav.languages ? Array.from(nav.languages) : [],
            timezone: (typeof Intl !== 'undefined' && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : '',
            timezone_offset_minutes: new Date().getTimezoneOffset(),
            dark_mode: typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false,
            
            // Network
            connection_type: (nav.connection && (nav.connection.effectiveType || nav.connection.type)) ? (nav.connection.effectiveType || nav.connection.type) : 'unknown',
            downlink_mbps: (nav.connection && nav.connection.downlink) ? nav.connection.downlink : null,
            rtt_ms: (nav.connection && nav.connection.rtt) ? nav.connection.rtt : null,
            cookies_enabled: nav.cookieEnabled || false
        };

        // Fetch Public IP & Geo Location (non-blocking)
        try {
            const ipResp = await fetch('https://freeipapi.com/api/json');
            if (ipResp.ok) {
                const ipData = await ipResp.json();
                telemetry.ip = ipData.ipAddress || null;
                telemetry.geo_country = ipData.countryName || null;
                telemetry.geo_country_code = ipData.countryCode || null;
                telemetry.geo_city = ipData.cityName || null;
                telemetry.geo_region = ipData.regionName || null;
                telemetry.geo_latitude = ipData.latitude || null;
                telemetry.geo_longitude = ipData.longitude || null;
                telemetry.geo_zip = ipData.zipCode || null;
            }
        } catch (_) {
            try {
                const fbResp = await fetch('https://api.ipify.org?format=json');
                if (fbResp.ok) {
                    const fbData = await fbResp.json();
                    telemetry.ip = fbData.ip || null;
                }
            } catch (_) {}
        }

        if (db && setDoc && doc) {
            const userDocRef = doc(db, 'users', userId);
            await setDoc(userDocRef, {
                last_telemetry: telemetry,
                last_login_at: telemetry.collected_at,
                last_ip: telemetry.ip || null,
                last_device: telemetry.device_type,
                last_platform: telemetry.platform,
                last_city: telemetry.geo_city || null,
                last_country: telemetry.geo_country || null
            }, { merge: true });

            const logId = ${Date.now()}_;
            await setDoc(doc(db, 'users', userId, 'telemetry_logs', logId), telemetry);
        }
        return telemetry;
    } catch (err) {
        console.warn('[CK Telemetry] Non-blocking notice:', err);
    }
}
