package com.licia.lifeos

import android.content.Context
import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.health.connect.client.permission.HealthPermission
import java.time.Duration
import java.time.Instant
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

class HealthBridge(
    private val context: Context,
    private val scope: CoroutineScope,
    private val runOnUiThread: (Runnable) -> Unit,
    private val requestPermissions: (Set<String>) -> Unit,
    private val onPermissionResult: ((Set<String>) -> Unit) -> Unit,
) {
    private val readPermissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
    )

    fun connect(callback: String) {
        val safeCallback = callback.takeIf { it.matches(Regex("[A-Za-z_$][A-Za-z0-9_$\.]{0,80}")) } ?: return
        if (Build.VERSION.SDK_INT < 28) {
            send(safeCallback, "{\"ok\":false,\"reason\":\"unsupported\"}")
            return
        }
        val availability = try {
            HealthConnectClient.getSdkStatus(context)
        } catch (_: Throwable) {
            -1
        }
        if (availability != HealthConnectClient.SDK_AVAILABLE) {
            send(safeCallback, "{\"ok\":false,\"reason\":\"health_connect_unavailable\"}")
            return
        }
        onPermissionResult { granted ->
            scope.launch {
                if (!granted.containsAll(readPermissions)) {
                    send(safeCallback, "{\"ok\":false,\"reason\":\"permission_denied\"}")
                    return@launch
                }
                readLastSevenDays(safeCallback)
            }
        }
        val client = HealthConnectClient.getOrCreate(context)
        scope.launch {
            val granted = runCatching { client.permissionController.getGrantedPermissions() }.getOrDefault(emptySet())
            if (!granted.containsAll(readPermissions)) requestPermissions(readPermissions)
            else readLastSevenDays(safeCallback)
        }
    }

    private suspend fun readLastSevenDays(callback: String) {
        val client = HealthConnectClient.getOrCreate(context)
        val end = Instant.now()
        val start = end.minusSeconds(7 * 24 * 60 * 60)
        val filter = TimeRangeFilter.between(start, end)
        try {
            val aggregate = client.aggregate(AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), filter))
            val steps = (aggregate[StepsRecord.COUNT_TOTAL] ?: 0L)
            val sleep = client.readRecords(ReadRecordsRequest(SleepSessionRecord::class, timeRangeFilter = filter)).records
                .sumOf { record -> Duration.between(record.startTime, record.endTime).toMinutes().coerceAtLeast(0) }
            send(callback, "{\"ok\":true,\"window_days\":7,\"steps\":$steps,\"sleep_minutes\":$sleep}")
        } catch (error: Throwable) {
            val message = (error.message ?: "health_read_failed").replace("\\", "\\\\").replace(""", "\\"").take(200)
            send(callback, "{\"ok\":false,\"reason\":\"read_failed\",\"message\":\"$message\"}")
        }
    }

    private fun send(callback: String, payload: String) {
        runOnUiThread(Runnable {
            val script = "try{window[$callback]($payload)}catch(e){}"
            // Callback names are restricted above; payload contains only controlled JSON.
            // The calling page remains responsible for correlating the response to a request.
        })
    }
}
