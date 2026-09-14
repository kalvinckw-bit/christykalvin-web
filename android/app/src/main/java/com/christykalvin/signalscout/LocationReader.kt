package com.christykalvin.signalscout

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import androidx.core.content.ContextCompat

/**
 * 以 GPS 為主、網路定位為輔，持續取得目前精準座標。
 * 只保留「較準確」或「較新」的定位，避免拿到過期或粗略的座標。
 */
class LocationReader(private val context: Context) {

    private val locationManager: LocationManager? =
        context.getSystemService(LocationManager::class.java)

    private var latest: Location? = null
    private var listening = false
    private var onUpdate: (() -> Unit)? = null

    private val listener = LocationListener { location ->
        if (isBetter(location, latest)) {
            latest = location
            onUpdate?.invoke()
        }
    }

    fun hasPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    fun isGpsEnabled(): Boolean =
        locationManager?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true

    @SuppressLint("MissingPermission")
    fun start(onUpdate: () -> Unit) {
        if (listening || !hasPermission()) return
        val lm = locationManager ?: return
        this.onUpdate = onUpdate
        listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER).forEach { provider ->
            try {
                if (lm.isProviderEnabled(provider)) {
                    lm.getLastKnownLocation(provider)?.let { if (isBetter(it, latest)) latest = it }
                    lm.requestLocationUpdates(provider, 1000L, 0f, listener, Looper.getMainLooper())
                }
            } catch (e: SecurityException) {
                // 權限被撤銷，忽略該 provider
            } catch (e: IllegalArgumentException) {
                // 裝置不支援該 provider
            }
        }
        listening = true
    }

    fun stop() {
        if (!listening) return
        try {
            locationManager?.removeUpdates(listener)
        } catch (e: SecurityException) {
            // 忽略
        }
        listening = false
        onUpdate = null
    }

    /** 目前定位；若太舊（預設 2 分鐘前）則視為無效。 */
    fun currentFix(maxAgeMs: Long = 120_000L): LocationFix? {
        val loc = latest ?: return null
        if (System.currentTimeMillis() - loc.time > maxAgeMs) return null
        return LocationFix(
            latitude = loc.latitude,
            longitude = loc.longitude,
            accuracyMeters = if (loc.hasAccuracy()) loc.accuracy else Float.MAX_VALUE,
            altitudeMeters = if (loc.hasAltitude()) loc.altitude else null,
            speedMps = if (loc.hasSpeed()) loc.speed else null,
            provider = loc.provider ?: "unknown",
            fixTimeMs = loc.time
        )
    }

    /**
     * 新定位是否優於舊定位：新很多（>30 秒）就採用，
     * 否則比較精確度，精確度相近時採用較新者。
     */
    private fun isBetter(candidate: Location, current: Location?): Boolean {
        if (current == null) return true
        val timeDelta = candidate.time - current.time
        if (timeDelta > 30_000L) return true
        if (timeDelta < -30_000L) return false
        if (!candidate.hasAccuracy()) return false
        if (!current.hasAccuracy()) return true
        return candidate.accuracy <= current.accuracy || timeDelta > 0
    }
}
