package com.trackbit.widget.heatmap

import android.content.Context
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.PreviewSizeMode
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.widget.R
import com.trackbit.widget.goAsync
import com.trackbit.widget.habit.HabitUuidKey
import com.trackbit.widget.habit.HabitWidgetState
import com.trackbit.widget.habit.HabitPickerActivity
import com.trackbit.widget.habit.chosenHabitUuid
import com.trackbit.widget.habit.habitWidgetState
import com.trackbit.widget.preview.PreviewHabits
import com.trackbit.widget.ui.WidgetTheme
import com.trackbit.widget.ui.openAppAction
import com.trackbit.widget.widgetEntryPoint
import com.trackbit.core.model.HistoryOwner
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
 * widget (see [HabitUuidKey]), which also keeps [HeatmapWindow]'s history in Room while placed.
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
        val observe = { habitUuid: String, day: LocalDate -> observeWithHistory(tracker, habitUuid, HeatmapWindow(day, firstDayOfWeek)) }
        // Loaded before provideContent, so the first frame isn't a loading state (as in W1).
        val initial = habitWidgetState(auth, widgetDay.today, flowOf(chosenHabitUuid(context, id)), observe).first()
        val chooseHabit = actionStartActivity(
            HabitPickerActivity.intent(context, GlanceAppWidgetManager(context).getAppWidgetId(id)),
        )
        provideContent {
            val habitUuid by rememberUpdatedState(currentState(HabitUuidKey))
            val state by remember { habitWidgetState(auth, widgetDay.today, snapshotFlow { habitUuid }, observe) }
                .collectAsState(initial)
            WidgetTheme { HeatmapWidgetContent(state, firstDayOfWeek, chooseHabit) }
        }
    }

    /** Previews have no exact size, so the grid is fitted to each of [PREVIEW_SIZES]. */
    override val previewSizeMode: PreviewSizeMode = SizeMode.Responsive(PREVIEW_SIZES)

    /**
     * The widget picker's sample (Android 15+, see `WidgetPreviews`). Its tap target is never
     * used, since previews take no clicks.
     */
    override suspend fun providePreview(context: Context, widgetCategory: Int) {
        val firstDayOfWeek = WeekFields.of(Locale.getDefault()).firstDayOfWeek
        val window = HeatmapWindow(PreviewHabits.DAY, firstDayOfWeek)
        val state = HabitWidgetState.Tracking(PreviewHabits.water(context, days = window.days))
        provideContent { WidgetTheme { HeatmapWidgetContent(state, firstDayOfWeek, chooseHabit = openAppAction(context)) } }
    }

    private companion object {
        /**
         * The launcher shows the largest that fits its preview frame, which is about the widget's
         * 4×2 size on the device, so the steps are close: the grid is sized to them, not stretched.
         */
        val PREVIEW_SIZES = listOf(250 to 110, 270 to 130, 290 to 150, 310 to 170, 330 to 180, 350 to 200)
            .map { (width, height) -> DpSize(width.dp, height.dp) }
            .toSet()
    }
}

/** The habit over [window], asking first for the history that fills it (a new day may move it). */
internal fun observeWithHistory(tracker: TrackerRepository, habitUuid: String, window: HeatmapWindow): Flow<TrackedHabit?> = flow {
    tracker.requestHistory(HistoryOwner.Heatmap, window.start)
    emitAll(tracker.observeHabit(habitUuid, window.today, window.days))
}

class HeatmapWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = HeatmapWidget()

    /** The last heatmap is gone: stop keeping history. */
    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        val tracker = context.widgetEntryPoint().tracker()
        goAsync { tracker.releaseHistory(HistoryOwner.Heatmap) }
    }
}
