package com.christykalvin.signalscout

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * 本機記錄與上傳佇列。
 *
 * 這一層是必要的，不是多餘的保險：本 App 的用途就是去「訊號很弱」的地方量測，
 * 那些地方正好最可能傳不出去。所以一律先寫本機，再慢慢補傳。
 */
class ReportStore(context: Context) {

    private val file = File(context.filesDir, "reports.json")
    private val records = mutableListOf<Record>()

    data class Record(val report: SignalReport, var uploaded: Boolean)

    init {
        load()
    }

    @Synchronized
    fun add(report: SignalReport) {
        records.add(Record(report, uploaded = false))
        if (records.size > MAX_RECORDS) {
            // 超量時，優先丟棄最舊且已上傳的資料
            val idx = records.indexOfFirst { it.uploaded }
            if (idx >= 0) records.removeAt(idx) else records.removeAt(0)
        }
        save()
    }

    @Synchronized
    fun pending(): List<SignalReport> = records.filter { !it.uploaded }.map { it.report }

    @Synchronized
    fun pendingCount(): Int = records.count { !it.uploaded }

    @Synchronized
    fun uploadedCount(): Int = records.count { it.uploaded }

    /** 最新的在前。 */
    @Synchronized
    fun recent(limit: Int): List<Record> =
        records.sortedByDescending { it.report.capturedAtMs }.take(limit)

    @Synchronized
    fun markUploaded(id: String) {
        records.firstOrNull { it.report.id == id }?.let {
            it.uploaded = true
            save()
        }
    }

    @Synchronized
    private fun load() {
        if (!file.exists()) return
        try {
            val arr = JSONArray(file.readText())
            records.clear()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                records.add(Record(SignalReport.fromJson(o.getJSONObject("report")), o.optBoolean("uploaded", false)))
            }
        } catch (e: Exception) {
            // 檔案毀損時不讓 App 起不來；改名保留現場，之後從空白重新開始
            runCatching { file.renameTo(File(file.parentFile, "reports.corrupt.json")) }
            records.clear()
        }
    }

    @Synchronized
    private fun save() {
        val arr = JSONArray()
        records.forEach { arr.put(JSONObject().put("report", it.report.toJson()).put("uploaded", it.uploaded)) }
        runCatching { file.writeText(arr.toString()) }
    }

    private companion object {
        const val MAX_RECORDS = 5000
    }
}
