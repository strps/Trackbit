package com.trackbit.widget.quicklog

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
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.provideContent
import androidx.glance.currentState
import com.trackbit.widget.R
import com.trackbit.widget.habit.HabitIdKey
import com.trackbit.widget.habit.HabitPickerActivity
import com.trackbit.widget.habit.chosenHabitId
import com.trackbit.widget.habit.habitWidgetState
import com.trackbit.widget.ui.WidgetTheme
import com.trackbit.widget.widgetEntryPoint
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flowOf
import java.time.LocalDate

/** W1: one habit, logged with a tap. A habit widget: see [HabitIdKey]. */
class QuickLogWidget : GlanceAppWidget(errorUiLayout = R.layout.widget_error) {
    override val sizeMode: SizeMode = SizeMode.Responsive(setOf(SMALL, WIDE, SQUARE))

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val entryPoint = context.widgetEntryPoint()
        val widgetDay = entryPoint.widgetDay()
        widgetDay.refresh()
        val auth = entryPoint.auth().state
        val tracker = entryPoint.tracker()
        val observe = { habitId: Int, day: LocalDate -> tracker.observeHabit(habitId, day) }
        // Loaded before provideContent, so the first frame isn't a loading state (as in W2).
        val initial = habitWidgetState(auth, widgetDay.today, flowOf(chosenHabitId(context, id)), observe).first()
        val chooseHabit = actionStartActivity(
            HabitPickerActivity.intent(context, GlanceAppWidgetManager(context).getAppWidgetId(id)),
        )
        provideContent {
            // Reconfiguring updates the Glance state of a running session, so the choice is
            // followed as a flow rather than read once.
            val habitId by rememberUpdatedState(currentState(HabitIdKey))
            val state by remember { habitWidgetState(auth, widgetDay.today, snapshotFlow { habitId }, observe) }
                .collectAsState(initial)
            WidgetTheme { QuickLogWidgetContent(state, chooseHabit) }
        }
    }

    companion object {
        // Target cells on Android 12+, per the widget sizing guide: 1×1, 2×1, 2×2.
        val SMALL = DpSize(40.dp, 40.dp)
        val WIDE = DpSize(110.dp, 40.dp)
        val SQUARE = DpSize(110.dp, 110.dp)
    }
}

class QuickLogWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = QuickLogWidget()
}
