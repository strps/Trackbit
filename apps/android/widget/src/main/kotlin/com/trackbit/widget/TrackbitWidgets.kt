package com.trackbit.widget

import android.content.BroadcastReceiver
import android.content.Context
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.updateAll
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.data.TrackerRepository
import com.trackbit.widget.heatmap.HeatmapWidget
import com.trackbit.widget.quicklog.QuickLogWidget
import com.trackbit.widget.today.TodayWidget
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/** Every widget the app provides. Add new widgets here, so they share rollover and refresh. */
internal object TrackbitWidgets {
    private fun all(): List<GlanceAppWidget> = listOf(TodayWidget(), QuickLogWidget(), HeatmapWidget())

    suspend fun updateAll(context: Context) = all().forEach { it.updateAll(context) }

    suspend fun anyPlaced(context: Context): Boolean {
        val manager = GlanceAppWidgetManager(context)
        return all().any { manager.getGlanceIds(it.javaClass).isNotEmpty() }
    }
}

/**
 * Glance creates widgets, receivers and action callbacks itself, so they reach Hilt through this
 * entry point instead of injection.
 */
@EntryPoint
@InstallIn(SingletonComponent::class)
interface WidgetEntryPoint {
    fun tracker(): TrackerRepository

    fun auth(): AuthRepository

    fun widgetDay(): WidgetDay
}

internal fun Context.widgetEntryPoint(): WidgetEntryPoint =
    EntryPointAccessors.fromApplication(applicationContext, WidgetEntryPoint::class.java)

/** Runs [block] off the main thread, keeping the broadcast alive until it finishes. */
internal fun BroadcastReceiver.goAsync(block: suspend () -> Unit) {
    val pending = goAsync()
    CoroutineScope(Dispatchers.Default).launch {
        try {
            block()
        } finally {
            pending.finish()
        }
    }
}
