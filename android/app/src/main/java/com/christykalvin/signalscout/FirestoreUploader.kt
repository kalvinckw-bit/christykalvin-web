package com.christykalvin.signalscout

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * 直接呼叫 Firestore REST API 上傳，不引入 Firebase SDK：
 * 少了 Google Play Services 依賴，App 體積小、離線行為也完全由自己掌控。
 *
 * 身分以 Firebase 匿名登入取得，因此 Firestore 規則可要求 request.auth != null。
 */
class FirestoreUploader(context: Context) {

    sealed class Result {
        object Success : Result()

        /** 網路不通或伺服器暫時性錯誤——保留在佇列，稍後重試。 */
        data class Retryable(val reason: String) : Result()

        /** 被規則拒絕或資料有問題——重試也不會成功，需要人介入。 */
        data class Permanent(val reason: String) : Result()
    }

    private val prefs = context.getSharedPreferences("signalscout_auth", Context.MODE_PRIVATE)

    fun upload(report: SignalReport): Result {
        val token = when (val t = idToken()) {
            is TokenResult.Ok -> t.token
            is TokenResult.Failed -> return t.result
        }
        return when (val r = postDocument(report, token)) {
            is Result.Permanent -> if (r.reason.startsWith("401")) {
                // Token 失效，清掉重新登入再試一次
                prefs.edit().clear().apply()
                when (val retry = idToken()) {
                    is TokenResult.Ok -> postDocument(report, retry.token)
                    is TokenResult.Failed -> retry.result
                }
            } else r
            else -> r
        }
    }

    // ---------- Firestore ----------

    private fun postDocument(report: SignalReport, token: String): Result {
        val url = "https://firestore.googleapis.com/v1/projects/${BuildConfig.FIREBASE_PROJECT_ID}" +
            "/databases/${BuildConfig.FIRESTORE_DATABASE_ID}/documents/${BuildConfig.FIRESTORE_COLLECTION}" +
            "?documentId=" + URLEncoder.encode(report.id, "UTF-8")

        return try {
            val (code, body) = httpPost(
                url = url,
                payload = documentBody(report).toString(),
                contentType = "application/json",
                bearer = token
            )
            when {
                code in 200..299 -> Result.Success
                // 同一筆已上傳過（重試造成），視為成功，避免重複資料
                code == 409 -> Result.Success
                code == 401 -> Result.Permanent("401 身分驗證失效")
                code == 403 -> Result.Permanent("403 被 Firestore 安全規則拒絕：$body")
                code in 400..499 -> Result.Permanent("$code $body")
                else -> Result.Retryable("$code $body")
            }
        } catch (e: IOException) {
            Result.Retryable(e.message ?: "網路不通")
        }
    }

    private fun documentBody(report: SignalReport): JSONObject {
        val loc = report.location
        val locFields = JSONObject().apply {
            put("geoPoint", JSONObject().put(
                "geoPointValue",
                JSONObject().put("latitude", loc.latitude).put("longitude", loc.longitude)
            ))
            put("latitude", doubleValue(loc.latitude))
            put("longitude", doubleValue(loc.longitude))
            put("accuracyMeters", doubleValue(loc.accuracyMeters.toDouble()))
            put("altitudeMeters", loc.altitudeMeters?.let { doubleValue(it) } ?: nullValue())
            put("speedMps", loc.speedMps?.let { doubleValue(it.toDouble()) } ?: nullValue())
            put("provider", stringValue(loc.provider))
            put("fixedAt", timestampValue(loc.fixTimeMs))
        }

        val simsArray = JSONArray()
        report.sims.forEach { simsArray.put(JSONObject().put("mapValue", JSONObject().put("fields", simFields(it)))) }

        val fields = JSONObject().apply {
            put("capturedAt", timestampValue(report.capturedAtMs))
            put("uploadedAt", timestampValue(System.currentTimeMillis()))
            put("deviceId", stringValue(report.deviceId))
            put("deviceModel", stringValue(report.deviceModel))
            put("appVersion", stringValue(report.appVersion))
            put("platform", stringValue("android"))
            put("automatic", JSONObject().put("booleanValue", report.automatic))
            put("note", stringValue(report.note))
            put("weakestLevel", integerValue(report.weakestLevel.toLong()))
            put("simCount", integerValue(report.sims.size.toLong()))
            put("location", JSONObject().put("mapValue", JSONObject().put("fields", locFields)))
            put("sims", JSONObject().put("arrayValue", JSONObject().put("values", simsArray)))
            // 主卡 / 副卡另外攤平存一份，Dashboard 查詢與篩選比較直接
            report.sim(0)?.let { put("main", JSONObject().put("mapValue", JSONObject().put("fields", simFields(it)))) }
            report.sim(1)?.let { put("sub", JSONObject().put("mapValue", JSONObject().put("fields", simFields(it)))) }
        }

        return JSONObject().put("fields", fields)
    }

    private fun simFields(sim: SimSignal): JSONObject = JSONObject().apply {
        put("slotIndex", integerValue(sim.slotIndex.toLong()))
        put("slotLabel", stringValue(sim.slotLabel))
        put("carrierName", stringValue(sim.carrierName))
        put("displayName", stringValue(sim.displayName))
        put("dbm", sim.dbm?.let { integerValue(it.toLong()) } ?: nullValue())
        put("level", integerValue(sim.level.toLong()))
        put("levelLabel", stringValue(SignalReader.describeLevel(sim.level)))
        put("asuLevel", sim.asuLevel?.let { integerValue(it.toLong()) } ?: nullValue())
        put("networkType", stringValue(sim.networkType))
        put("signalClass", stringValue(sim.signalClass))
    }

    private fun stringValue(v: String) = JSONObject().put("stringValue", v)
    private fun doubleValue(v: Double) = JSONObject().put("doubleValue", v)
    private fun integerValue(v: Long) = JSONObject().put("integerValue", v.toString())
    private fun nullValue() = JSONObject().put("nullValue", JSONObject.NULL)
    private fun timestampValue(ms: Long) = JSONObject().put("timestampValue", iso8601(ms))

    private fun iso8601(ms: Long): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
        fmt.timeZone = TimeZone.getTimeZone("UTC")
        return fmt.format(Date(ms))
    }

    // ---------- 匿名身分 ----------

    private sealed class TokenResult {
        data class Ok(val token: String) : TokenResult()
        data class Failed(val result: Result) : TokenResult()
    }

    private fun idToken(): TokenResult {
        val cached = prefs.getString(KEY_ID_TOKEN, null)
        val expiry = prefs.getLong(KEY_EXPIRES_AT, 0L)
        if (cached != null && System.currentTimeMillis() < expiry - 60_000L) {
            return TokenResult.Ok(cached)
        }
        prefs.getString(KEY_REFRESH_TOKEN, null)?.let { refresh ->
            refreshToken(refresh)?.let { return TokenResult.Ok(it) }
        }
        return signInAnonymously()
    }

    private fun signInAnonymously(): TokenResult {
        val url = "https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${BuildConfig.FIREBASE_API_KEY}"
        return try {
            val (code, body) = httpPost(
                url = url,
                payload = JSONObject().put("returnSecureToken", true).toString(),
                contentType = "application/json",
                bearer = null
            )
            if (code !in 200..299) {
                val hint = if (body.contains("ADMIN_ONLY_OPERATION") || body.contains("OPERATION_NOT_ALLOWED")) {
                    "請先到 Firebase Console → Authentication 啟用「匿名」登入方式"
                } else body
                return TokenResult.Failed(Result.Permanent("登入失敗($code)：$hint"))
            }
            val json = JSONObject(body)
            storeTokens(
                idToken = json.getString("idToken"),
                refreshToken = json.getString("refreshToken"),
                expiresInSec = json.optString("expiresIn", "3600").toLongOrNull() ?: 3600L
            )
            TokenResult.Ok(json.getString("idToken"))
        } catch (e: IOException) {
            TokenResult.Failed(Result.Retryable(e.message ?: "網路不通"))
        }
    }

    private fun refreshToken(refresh: String): String? = try {
        val url = "https://securetoken.googleapis.com/v1/token?key=${BuildConfig.FIREBASE_API_KEY}"
        val form = "grant_type=refresh_token&refresh_token=" + URLEncoder.encode(refresh, "UTF-8")
        val (code, body) = httpPost(url, form, "application/x-www-form-urlencoded", null)
        if (code in 200..299) {
            val json = JSONObject(body)
            val token = json.getString("id_token")
            storeTokens(token, json.getString("refresh_token"), json.optString("expires_in", "3600").toLongOrNull() ?: 3600L)
            token
        } else null
    } catch (e: IOException) {
        null
    }

    private fun storeTokens(idToken: String, refreshToken: String, expiresInSec: Long) {
        prefs.edit()
            .putString(KEY_ID_TOKEN, idToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putLong(KEY_EXPIRES_AT, System.currentTimeMillis() + expiresInSec * 1000L)
            .apply()
    }

    // ---------- HTTP ----------

    private fun httpPost(url: String, payload: String, contentType: String, bearer: String?): Pair<Int, String> {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 20_000
            doOutput = true
            setRequestProperty("Content-Type", contentType)
            bearer?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        return try {
            conn.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val body = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            code to body
        } finally {
            conn.disconnect()
        }
    }

    private companion object {
        const val KEY_ID_TOKEN = "id_token"
        const val KEY_REFRESH_TOKEN = "refresh_token"
        const val KEY_EXPIRES_AT = "expires_at"
    }
}
