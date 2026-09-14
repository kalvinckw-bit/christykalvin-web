package com.christykalvin.signalscout

import android.Manifest
import android.content.Context
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.christykalvin.signalscout.databinding.ActivityMainBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var signalReader: SignalReader
    private lateinit var locationReader: LocationReader
    private lateinit var store: ReportStore
    private lateinit var uploader: FirestoreUploader

    private val executor = Executors.newSingleThreadExecutor()
    private val handler = Handler(Looper.getMainLooper())
    private val uploading = AtomicBoolean(false)
    private val timeFormat = SimpleDateFormat("MM/dd HH:mm:ss", Locale.getDefault())

    private var lastSims: List<SimSignal> = emptyList()

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { granted ->
        if (granted.values.all { it }) {
            locationReader.start { refreshLocation() }
        } else {
            Toast.makeText(this, R.string.need_permission, Toast.LENGTH_LONG).show()
        }
        refreshSignals()
    }

    private val refreshTick = object : Runnable {
        override fun run() {
            refreshSignals()
            refreshLocation()
            handler.postDelayed(this, 2_000L)
        }
    }

    private val autoTick = object : Runnable {
        override fun run() {
            if (binding.cbAuto.isChecked) {
                capture(automatic = true)
                handler.postDelayed(this, 30_000L)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        signalReader = SignalReader(this)
        locationReader = LocationReader(this)
        store = ReportStore(this)
        uploader = FirestoreUploader(this)

        binding.btnCapture.setOnClickListener { capture(automatic = false) }
        binding.btnSync.setOnClickListener { flush(userTriggered = true) }
        binding.cbAuto.setOnCheckedChangeListener { _, checked ->
            handler.removeCallbacks(autoTick)
            if (checked) handler.postDelayed(autoTick, 30_000L)
        }

        requestPermissionsIfNeeded()
        renderHistory()
        refreshQueue()
    }

    override fun onResume() {
        super.onResume()
        if (signalReader.hasPermissions()) locationReader.start { refreshLocation() }
        handler.post(refreshTick)
        flush(userTriggered = false)
    }

    override fun onPause() {
        super.onPause()
        handler.removeCallbacks(refreshTick)
        handler.removeCallbacks(autoTick)
        locationReader.stop()
    }

    override fun onDestroy() {
        super.onDestroy()
        executor.shutdown()
    }

    private fun requestPermissionsIfNeeded() {
        if (!signalReader.hasPermissions()) {
            permissionLauncher.launch(
                arrayOf(Manifest.permission.READ_PHONE_STATE, Manifest.permission.ACCESS_FINE_LOCATION)
            )
        } else {
            locationReader.start { refreshLocation() }
        }
    }

    // ---------- 畫面更新 ----------

    private fun refreshSignals() {
        lastSims = signalReader.readAll()
        val container = binding.simContainer
        container.removeAllViews()

        if (lastSims.isEmpty()) {
            container.addView(infoText(getString(R.string.no_sim)))
            return
        }
        lastSims.forEach { container.addView(simCard(it)) }
    }

    private fun refreshLocation() {
        val fix = locationReader.currentFix()
        binding.tvGps.text = when {
            !locationReader.hasPermission() -> getString(R.string.need_permission)
            fix == null && !locationReader.isGpsEnabled() -> "GPS 未開啟，請到系統設定開啟定位"
            fix == null -> getString(R.string.gps_waiting)
            else -> buildString {
                append("緯度 ").append(String.format(Locale.US, "%.6f", fix.latitude))
                append("\n經度 ").append(String.format(Locale.US, "%.6f", fix.longitude))
                append("\n精確度 ±").append(String.format(Locale.US, "%.0f", fix.accuracyMeters)).append(" 公尺")
                append("（").append(if (fix.provider == "gps") "GPS 衛星" else "網路定位").append("）")
            }
        }
        binding.btnCapture.isEnabled = fix != null
    }

    private fun simCard(sim: SimSignal): View {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 24, 28, 24)
            setBackgroundColor(Color.parseColor("#F8F9FA"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = 16 }
        }
        val title = TextView(this).apply {
            text = "${sim.slotLabel}　${sim.carrierName}"
            textSize = 15f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val level = TextView(this).apply {
            val dbmText = sim.dbm?.let { "$it dBm" } ?: "讀不到 dBm"
            text = "${SignalReader.describeLevel(sim.level)}　${sim.level}/4 格　$dbmText"
            textSize = 19f
            setTextColor(levelColor(sim.level))
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }
        val detail = TextView(this).apply {
            text = "${sim.networkType}　制式 ${sim.signalClass}"
            textSize = 13f
            setTextColor(Color.parseColor("#6C757D"))
        }
        box.addView(title)
        box.addView(level)
        box.addView(detail)
        return box
    }

    private fun infoText(message: String): View = TextView(this).apply {
        text = message
        textSize = 14f
        gravity = Gravity.CENTER
        setPadding(16, 32, 16, 32)
        setTextColor(Color.parseColor("#6C757D"))
    }

    private fun levelColor(level: Int): Int = when (level) {
        0, 1 -> Color.parseColor("#D62828")
        2 -> Color.parseColor("#F77F00")
        3 -> Color.parseColor("#1D3557")
        else -> Color.parseColor("#2A9D8F")
    }

    private fun refreshQueue() {
        val pending = store.pendingCount()
        binding.tvQueue.text = "待上傳 $pending 筆（已上傳 ${store.uploadedCount()} 筆）"
        binding.btnSync.isEnabled = pending > 0
    }

    private fun renderHistory() {
        val container = binding.historyContainer
        container.removeAllViews()
        val recent = store.recent(20)
        if (recent.isEmpty()) {
            container.addView(infoText("尚無記錄"))
            return
        }
        recent.forEach { record ->
            val r = record.report
            val row = TextView(this).apply {
                textSize = 13f
                setPadding(16, 18, 16, 18)
                val sims = r.sims.joinToString("　") {
                    "${it.slotLabel} ${it.level}/4" + (it.dbm?.let { d -> " ($d)" } ?: "")
                }
                val flag = if (record.uploaded) "已上傳" else "待上傳"
                text = "${timeFormat.format(Date(r.capturedAtMs))}　$flag\n$sims" +
                    (if (r.note.isNotBlank()) "\n備註：${r.note}" else "")
                setTextColor(if (record.uploaded) Color.parseColor("#495057") else Color.parseColor("#D62828"))
            }
            container.addView(row)
        }
    }

    // ---------- 記錄與上傳 ----------

    private fun capture(automatic: Boolean) {
        val fix = locationReader.currentFix()
        if (fix == null) {
            if (!automatic) Toast.makeText(this, "還沒定位到，請到戶外等 GPS 定位", Toast.LENGTH_SHORT).show()
            return
        }
        val sims = signalReader.readAll()
        if (sims.isEmpty() && !automatic) {
            Toast.makeText(this, R.string.no_sim, Toast.LENGTH_SHORT).show()
            return
        }

        val report = SignalReport(
            id = UUID.randomUUID().toString(),
            capturedAtMs = System.currentTimeMillis(),
            location = fix,
            sims = sims,
            note = binding.etNote.text.toString().trim(),
            deviceId = deviceId(),
            deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}",
            appVersion = BuildConfig.VERSION_NAME,
            automatic = automatic
        )
        store.add(report)
        renderHistory()
        refreshQueue()
        if (!automatic) Toast.makeText(this, "已記錄，準備上傳", Toast.LENGTH_SHORT).show()
        flush(userTriggered = false)
    }

    private fun flush(userTriggered: Boolean) {
        if (store.pendingCount() == 0) {
            if (userTriggered) Toast.makeText(this, "沒有待上傳的記錄", Toast.LENGTH_SHORT).show()
            return
        }
        if (!uploading.compareAndSet(false, true)) return

        executor.execute {
            var blocked: String? = null
            for (report in store.pending()) {
                when (val result = uploader.upload(report)) {
                    is FirestoreUploader.Result.Success -> store.markUploaded(report.id)
                    is FirestoreUploader.Result.Permanent -> {
                        blocked = result.reason
                        break
                    }
                    is FirestoreUploader.Result.Retryable -> break
                }
            }
            val message = blocked
            handler.post {
                uploading.set(false)
                refreshQueue()
                renderHistory()
                if (message != null) {
                    Toast.makeText(this, "上傳被拒絕：$message", Toast.LENGTH_LONG).show()
                } else if (userTriggered) {
                    val left = store.pendingCount()
                    val text = if (left == 0) "全部上傳完成" else "還有 $left 筆待上傳（等有訊號時會自動補傳）"
                    Toast.makeText(this, text, Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun deviceId(): String {
        val prefs = getSharedPreferences("signalscout", Context.MODE_PRIVATE)
        prefs.getString("device_id", null)?.let { return it }
        val id = UUID.randomUUID().toString()
        prefs.edit().putString("device_id", id).apply()
        return id
    }
}
