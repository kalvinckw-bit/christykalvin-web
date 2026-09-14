package com.christykalvin.signalscout

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.telephony.CellSignalStrength
import android.telephony.CellSignalStrengthCdma
import android.telephony.CellSignalStrengthGsm
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthNr
import android.telephony.CellSignalStrengthTdscdma
import android.telephony.CellSignalStrengthWcdma
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat

/**
 * 讀取每一張實體 SIM 卡（雙卡：主卡 slot 0、副卡 slot 1）當下的訊號強度。
 *
 * 這是整個方案唯一必須由原生 App 完成的部分——瀏覽器沒有任何 API 可以取得蜂巢訊號強度，
 * 也無法區分雙卡。iOS 同樣沒有公開 API，因此本功能僅 Android 可用。
 */
class SignalReader(private val context: Context) {

    private val subscriptionManager: SubscriptionManager? =
        context.getSystemService(SubscriptionManager::class.java)

    private val telephonyManager: TelephonyManager? =
        context.getSystemService(TelephonyManager::class.java)

    fun hasPermissions(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) ==
            PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED

    /** 回傳所有已啟用的 SIM 卡訊號，依卡槽排序（主卡在前）。 */
    @SuppressLint("MissingPermission")
    fun readAll(): List<SimSignal> {
        if (!hasPermissions()) return emptyList()
        val sm = subscriptionManager ?: return emptyList()
        val subs: List<SubscriptionInfo> = try {
            sm.activeSubscriptionInfoList ?: emptyList()
        } catch (e: SecurityException) {
            emptyList()
        }
        return subs.sortedBy { it.simSlotIndex }.mapNotNull { read(it) }
    }

    @SuppressLint("MissingPermission")
    private fun read(info: SubscriptionInfo): SimSignal? {
        val base = telephonyManager ?: return null
        val tm = try {
            base.createForSubscriptionId(info.subscriptionId)
        } catch (e: Exception) {
            return null
        }

        val dataNetworkType = try {
            tm.dataNetworkType
        } catch (e: SecurityException) {
            TelephonyManager.NETWORK_TYPE_UNKNOWN
        }

        val strengths: List<CellSignalStrength> = try {
            tm.signalStrength?.cellSignalStrengths ?: emptyList()
        } catch (e: SecurityException) {
            emptyList()
        }

        val chosen = pickStrength(strengths, dataNetworkType)
        val rawDbm = chosen?.dbm
        val dbm = if (rawDbm == null || rawDbm == Int.MAX_VALUE || rawDbm == 0) null else rawDbm
        val rawAsu = chosen?.asuLevel
        val asu = if (rawAsu == null || rawAsu == Int.MAX_VALUE || rawAsu == 99) null else rawAsu

        val hasNr = strengths.any { it is CellSignalStrengthNr && it.dbm != Int.MAX_VALUE }
        val carrier = info.carrierName?.toString().orEmpty().ifBlank { tm.networkOperatorName.orEmpty() }

        return SimSignal(
            slotIndex = info.simSlotIndex,
            subscriptionId = info.subscriptionId,
            carrierName = carrier.ifBlank { "未知電信商" },
            displayName = info.displayName?.toString().orEmpty(),
            dbm = dbm,
            level = chosen?.level ?: 0,
            asuLevel = asu,
            networkType = describeNetworkType(dataNetworkType, hasNr),
            signalClass = describeSignalClass(chosen)
        )
    }

    /**
     * 一張卡可能同時回報多種制式的訊號（例如 5G NSA 會同時有 LTE 與 NR）。
     * 優先取與目前資料網路制式相符者，否則取第一個有效讀數。
     */
    private fun pickStrength(
        strengths: List<CellSignalStrength>,
        dataNetworkType: Int
    ): CellSignalStrength? {
        if (strengths.isEmpty()) return null
        val preferred: Class<*>? = when (dataNetworkType) {
            TelephonyManager.NETWORK_TYPE_NR -> CellSignalStrengthNr::class.java
            TelephonyManager.NETWORK_TYPE_LTE -> CellSignalStrengthLte::class.java
            TelephonyManager.NETWORK_TYPE_UMTS,
            TelephonyManager.NETWORK_TYPE_HSDPA,
            TelephonyManager.NETWORK_TYPE_HSUPA,
            TelephonyManager.NETWORK_TYPE_HSPA,
            TelephonyManager.NETWORK_TYPE_HSPAP -> CellSignalStrengthWcdma::class.java
            TelephonyManager.NETWORK_TYPE_GPRS,
            TelephonyManager.NETWORK_TYPE_EDGE,
            TelephonyManager.NETWORK_TYPE_GSM -> CellSignalStrengthGsm::class.java
            else -> null
        }
        val valid = strengths.filter { it.dbm != Int.MAX_VALUE }
        if (preferred != null) {
            valid.firstOrNull { preferred.isInstance(it) }?.let { return it }
        }
        return valid.firstOrNull() ?: strengths.first()
    }

    private fun describeSignalClass(strength: CellSignalStrength?): String = when (strength) {
        is CellSignalStrengthNr -> "NR"
        is CellSignalStrengthLte -> "LTE"
        is CellSignalStrengthWcdma -> "WCDMA"
        is CellSignalStrengthTdscdma -> "TD-SCDMA"
        is CellSignalStrengthGsm -> "GSM"
        is CellSignalStrengthCdma -> "CDMA"
        else -> "未知"
    }

    private fun describeNetworkType(type: Int, hasNr: Boolean): String = when (type) {
        TelephonyManager.NETWORK_TYPE_NR -> "5G"
        TelephonyManager.NETWORK_TYPE_LTE -> if (hasNr) "5G (NSA)" else "4G"
        TelephonyManager.NETWORK_TYPE_UMTS,
        TelephonyManager.NETWORK_TYPE_HSDPA,
        TelephonyManager.NETWORK_TYPE_HSUPA,
        TelephonyManager.NETWORK_TYPE_HSPA,
        TelephonyManager.NETWORK_TYPE_HSPAP,
        TelephonyManager.NETWORK_TYPE_EVDO_0,
        TelephonyManager.NETWORK_TYPE_EVDO_A,
        TelephonyManager.NETWORK_TYPE_EVDO_B,
        TelephonyManager.NETWORK_TYPE_TD_SCDMA -> "3G"
        TelephonyManager.NETWORK_TYPE_GPRS,
        TelephonyManager.NETWORK_TYPE_EDGE,
        TelephonyManager.NETWORK_TYPE_CDMA,
        TelephonyManager.NETWORK_TYPE_1xRTT,
        TelephonyManager.NETWORK_TYPE_IDEN,
        TelephonyManager.NETWORK_TYPE_GSM -> "2G"
        TelephonyManager.NETWORK_TYPE_IWLAN -> "WiFi 通話"
        else -> "無訊號 / 未知"
    }

    companion object {
        /** 0~4 格轉成中文描述，與 Dashboard 的顏色分級一致。 */
        fun describeLevel(level: Int): String = when (level) {
            0 -> "無訊號"
            1 -> "極弱"
            2 -> "弱"
            3 -> "良好"
            else -> "很強"
        }
    }
}
