package com.trackbit.widget.quicklog

import android.content.Context
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.appwidget.state.getAppWidgetState
import androidx.glance.appwidget.state.updateAppWidgetState
import androidx.glance.currentState
import com.trackbit.widget.R
import com.trackbit.widget.ui.WidgetTheme
import com.trackbit.widget.widgetEntryPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf

/**
 * W1: one habit, logged with a tap. The habit is chosen in [QuickLogConfigActivity] and kept in
 * the instance's Glance state (the default Preferences definition), which is all it stores:
 * everything shown comes from Room.
 */
class QuickLogWidget : GlanceAppWidget(errorUiLayout = R.layout.widget_error) {
    override val sizeMode: SizeMode = SizeMode.Responsive(setOf(SMALL, WIDE, SQUARE))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val entryPoint = context.widgetEntryPoint()
        val widgetDay = entryPoint.widgetDay()
        widgetDay.refresh()
        val auth = entryPoint.auth().state
        val tracker = entryPoint.tracker()
        val chosen = getAppWidgetState<Preferences>(context, id)[HabitIdKey]
        // Loaded before provideContent, so the first frame isn't a loading state (as in W2).
        val initial = quickLogState(auth, widgetDay.today, tracker, flowOf(chosen)).first()
        val chooseHabit = actionStartActivity(
            QuickLogConfigActivity.intent(context, GlanceAppWidgetManager(context).getAppWidgetId(id)),
        )
        provideContent {
            // Reconfiguring updates the Glance state of a running session, so the choice is
            // followed as a flow rather than read once.
            val habitId by rememberUpdatedState(currentState(HabitIdKey))
            val state by remember { quickLogState(auth, widgetDay.today, tracker, snapshotFlow { habitId }) }
                .collectAsState(initial)
            WidgetTheme { QuickLogWidgetContent(state, chooseHabit) }
        }
    }

    companion object {
        // Target cells on Android 12+, per the widget sizing guide: 1×1, 2×1, 2×2.
        val SMALL = DpSize(40.dp, 40.dp)
        val WIDE = DpSize(110.dp, 40.dp)
        val SQUARE = DpSize(110.dp, 110.dp)

        private val HabitIdKey = intPreferencesKey("habitId")

        /** Points the widget [id] at [habitId] and re-renders it. */
        internal suspend fun choose(context: Context, id: GlanceId, habitId: Int) {
            updateAppWidgetState(context, id) { it[HabitIdKey] = habitId }
            QuickLogWidget().update(context, id)
        }
    }
}

class QuickLogWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = QuickLogWidget()
}
