package com.trackbit.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Moves widgets to the new day: at local midnight ([WidgetDay]'s alarm), and when the clock or
 * the timezone changes. Without placed widgets it does nothing, so the alarm stops re-arming.
 */
class DayRolloverReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action !in HANDLED_ACTIONS) return
        val appContext = context.applicationContext
        goAsync {
            if (TrackbitWidgets.anyPlaced(appContext)) {
                appContext.widgetEntryPoint().widgetDay().refresh()
                TrackbitWidgets.updateAll(appContext)
            }
        }
    }

    companion object {
        const val ACTION_ROLLOVER = "com.trackbit.widget.action.DAY_ROLLOVER"

        private val HANDLED_ACTIONS = setOf(ACTION_ROLLOVER, Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED)
    }
}
