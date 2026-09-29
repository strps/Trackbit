package com.trackbit.widget.heatmap

import android.content.Context
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.widget.R
import com.trackbit.widget.goAsync
import com.trackbit.widget.habit.HabitIdKey
import com.trackbit.widget.habit.HabitPickerActivity
import com.trackbit.widget.habit.chosenHabitId
import com.trackbit.widget.habit.habitWidgetState
import com.trackbit.widget.ui.WidgetTheme
import com.trackbit.widget.widgetEntryPoint
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.emitAll
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOf
import java.time.LocalDate
import java.time.temporal.WeekFields
import java.util.Locale

/**
 * W3: one habit's last months on its heatmap gradient. Read-only; a tap opens the app. A habit
 * widget (see [HabitIdKey]), which also keeps [HeatmapWindow]'s history in Room while placed.
 */
class HeatmapWidget : GlanceAppWidget(errorUiLayout = R.layout.widget_error) {
    // The grid is sized to the exact space: cells as large as the height allows, as many weeks
    // as then fit the width.
    override val sizeMode: SizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val entryPoint = context.widgetEntryPoint()
        val widgetDay = entryPoint.widgetDay()
        widgetDay.refresh()
        val auth = entryPoint.auth().state
        val tracker = entryPoint.tracker()
        val firstDayOfWeek = WeekFields.of(Locale.getDefault()).firstDayOfWeek
        val observe = { habitId: Int, day: LocalDate -> observeWithHistory(tracker, habitId, HeatmapWindow(day, firstDayOfWeek)) }
        // Loaded before provideContent, so the first frame isn't a loading state (as in W1).
        val initial = habitWidgetState(auth, widgetDay.today, flowOf(chosenHabitId(context, id)), observe).first()
        val chooseHabit = actionStartActivity(
            HabitPickerActivity.intent(context, GlanceAppWidgetManager(context).getAppWidgetId(id)),
        )
        provideContent {
            val habitId by rememberUpdatedState(currentState(HabitIdKey))
            val state by remember { habitWidgetState(auth, widgetDay.today, snapshotFlow { habitId }, observe) }
                .collectAsState(initial)
            WidgetTheme { HeatmapWidgetContent(state, firstDayOfWeek, chooseHabit) }
        }
    }
}

/** The habit over [window], asking first for the history that fills it (a new day may move it). */
internal fun observeWithHistory(tracker: TrackerRepository, habitId: Int, window: HeatmapWindow): Flow<TrackedHabit?> = flow {
    tracker.requestHistory(window.start)
    emitAll(tracker.observeHabit(habitId, window.today, window.days))
}

class HeatmapWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = HeatmapWidget()

    /** The last heatmap is gone: stop keeping history. */
    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        val tracker = context.widgetEntryPoint().tracker()
        goAsync { tracker.releaseHistory() }
    }
}
