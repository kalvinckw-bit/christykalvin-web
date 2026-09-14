package com.christykalvin.signalscout

import org.json.JSONArray
import org.json.JSONObject

/** 單張 SIM 卡當下的訊號狀況。slotIndex 0 = 主卡，1 = 副卡。 */
data class SimSignal(
    val slotIndex: Int,
    val subscriptionId: Int,
    val carrierName: String,
    val displayName: String,
    val dbm: Int?,
    val level: Int,
    val asuLevel: Int?,
    val networkType: String,
    val signalClass: String
) {
    val slotLabel: String get() = if (slotIndex == 0) "主卡" else "副卡"

    fun toJson(): JSONObject = JSONObject().apply {
        put("slotIndex", slotIndex)
        put("slotLabel", slotLabel)
        put("subscriptionId", subscriptionId)
        put("carrierName", carrierName)
        put("displayName", displayName)
        put("dbm", dbm ?: JSONObject.NULL)
        put("level", level)
        put("asuLevel", asuLevel ?: JSONObject.NULL)
        put("networkType", networkType)
        put("signalClass", signalClass)
    }

    companion object {
        fun fromJson(o: JSONObject) = SimSignal(
            slotIndex = o.getInt("slotIndex"),
            subscriptionId = o.getInt("subscriptionId"),
            carrierName = o.getString("carrierName"),
            displayName = o.getString("displayName"),
            dbm = if (o.isNull("dbm")) null else o.getInt("dbm"),
            level = o.getInt("level"),
            asuLevel = if (o.isNull("asuLevel")) null else o.getInt("asuLevel"),
            networkType = o.getString("networkType"),
            signalClass = o.getString("signalClass")
        )
    }
}

/** 一次 GPS 定位結果。 */
data class LocationFix(
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Float,
    val altitudeMeters: Double?,
    val speedMps: Float?,
    val provider: String,
    val fixTimeMs: Long
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("latitude", latitude)
        put("longitude", longitude)
        put("accuracyMeters", accuracyMeters.toDouble())
        put("altitudeMeters", altitudeMeters ?: JSONObject.NULL)
        put("speedMps", speedMps?.toDouble() ?: JSONObject.NULL)
        put("provider", provider)
        put("fixTimeMs", fixTimeMs)
    }

    companion object {
        fun fromJson(o: JSONObject) = LocationFix(
            latitude = o.getDouble("latitude"),
            longitude = o.getDouble("longitude"),
            accuracyMeters = o.getDouble("accuracyMeters").toFloat(),
            altitudeMeters = if (o.isNull("altitudeMeters")) null else o.getDouble("altitudeMeters"),
            speedMps = if (o.isNull("speedMps")) null else o.getDouble("speedMps").toFloat(),
            provider = o.getString("provider"),
            fixTimeMs = o.getLong("fixTimeMs")
        )
    }
}

/** 一筆完整回報：位置 + 當下所有 SIM 卡訊號。 */
data class SignalReport(
    val id: String,
    val capturedAtMs: Long,
    val location: LocationFix,
    val sims: List<SimSignal>,
    val note: String,
    val deviceId: String,
    val deviceModel: String,
    val appVersion: String,
    val automatic: Boolean
) {
    /** 兩張卡之中最弱的格數，Dashboard 用來決定地圖標記顏色。 */
    val weakestLevel: Int get() = sims.minOfOrNull { it.level } ?: 0

    fun sim(slot: Int): SimSignal? = sims.firstOrNull { it.slotIndex == slot }

    fun toJson(): JSONObject = JSONObject().apply {
        put("id", id)
        put("capturedAtMs", capturedAtMs)
        put("location", location.toJson())
        put("sims", JSONArray().also { arr -> sims.forEach { arr.put(it.toJson()) } })
        put("note", note)
        put("deviceId", deviceId)
        put("deviceModel", deviceModel)
        put("appVersion", appVersion)
        put("automatic", automatic)
    }

    companion object {
        fun fromJson(o: JSONObject): SignalReport {
            val arr = o.getJSONArray("sims")
            return SignalReport(
                id = o.getString("id"),
                capturedAtMs = o.getLong("capturedAtMs"),
                location = LocationFix.fromJson(o.getJSONObject("location")),
                sims = (0 until arr.length()).map { SimSignal.fromJson(arr.getJSONObject(it)) },
                note = o.optString("note", ""),
                deviceId = o.getString("deviceId"),
                deviceModel = o.optString("deviceModel", ""),
                appVersion = o.optString("appVersion", ""),
                automatic = o.optBoolean("automatic", false)
            )
        }
    }
}
