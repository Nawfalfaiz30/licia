package com.licia.lifeos

import android.webkit.WebView
import org.json.JSONObject
import android.content.Context
import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.permission.HealthPermission
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant

class HealthBridge(
    private val context: Context,
    private val scope: CoroutineScope,
    private val runOnUiThread: (Runnable) -> Unit,
    private val requestPermissions: (Set<String>) -> Unit,
) {
    val readPermissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
    )

    fun connect(callback: String, granted: Set<String> = emptySet()) {
        val safeCallback = callback.takeIf { it.matches(Regex("[A-Za-z_$][A-Za-z0-9_$\\.]{0,80}")) } ?: return
        if (Build.VERSION.SDK_INT < 28) {
            send(safeCallback, "{\"ok\":false,\"reason\":\"unsupported\"}")
            return
        }
        val availability = runCatching { HealthConnectClient.getSdkStatus(context) }.getOrDefault(-1)
        if (availability != HealthConnectClient.SDK_AVAILABLE) {
            send(safeCallback, "{\"ok\":false,\"reason\":\"health_connect_unavailable\"}")
            return
        }
        if (!granted.containsAll(readPermissions)) {
            requestPermissions(readPermissions)
            send(safeCallback, "{\"ok\":false,\"reason\":\"permission_required\"}")
            return
        }
        scope.launch { readLastSevenDays(safeCallback) }
    }

    private suspend fun readLastSevenDays(callback: String) {
        val client = HealthConnectClient.getOrCreate(context)
        val end = Instant.now()
        val start = end.minusSeconds(7 * 24 * 60 * 60)
        val filter = TimeRangeFilter.between(start, end)
        try {
            val aggregate = client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), filter))
            val steps = aggregate[StepsRecord.COUNT_TOTAL] ?: 0L
            val sleepMinutes = client.readRecords(
                ReadRecordsRequest(SleepSessionRecord::class, timeRangeFilter = filter)
            ).records.sumOf { record ->
                Duration.between(record.startTime, record.endTime).toMinutes().coerceAtLeast(0)
            }
            send(callback, "{\"ok\":true,\"window_days\":7,\"steps\":$steps,\"sleep_minutes\":$sleepMinutes}")
        } catch (error: Throwable) {
            val message = (error.message ?: "health_read_failed").replace("\\", "\\\\").replace(""", "\\"").take(200)
            send(callback, "{\"ok\":false,\"reason\":\"read_failed\",\"message\":\"$message\"}")
        }
    }

    private fun send(callback: String, payload: String) {
        runOnUiThread(Runnable {
            // Activity supplies a callback that evaluates this against the page.
            // No arbitrary JS is accepted here: callback names are regex-restricted above.
            (context as? android.app.Activity)?.findViewById<android.webkit.WebView>(com.licia.lifeos.R.id.web_view)
                ?.evaluateJavascript("try{window[" + JSONObject.quote(callback) + "](" + payload + ")}catch(e){}", null)
        })
    }
}
