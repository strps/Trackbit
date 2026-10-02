package com.trackbit.widget.today

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.provideContent
import androidx.glance.state.GlanceStateDefinition
import androidx.compose.runtime.collectAsState
import com.trackbit.widget.R
import com.trackbit.widget.preview.PreviewHabits
import com.trackbit.widget.ui.WidgetTheme
import com.trackbit.widget.widgetEntryPoint
import kotlinx.coroutines.flow.first

/** W2: every habit today, with a tap-to-log control per row. */
class TodayWidget : GlanceAppWidget(errorUiLayout = R.layout.widget_error) {
    // All state lives in Room; there is nothing per widget instance to store.
    override val stateDefinition: GlanceStateDefinition<*>? = null

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val entryPoint = context.widgetEntryPoint()
        val widgetDay = entryPoint.widgetDay()
        widgetDay.refresh()
        val state = todayWidgetState(entryPoint.auth().state, widgetDay.today, entryPoint.tracker())
        // Loaded before provideContent, so the first frame isn't a loading state. `update` doesn't
        // restart a running session, which is why the composition keeps collecting.
        val initial = state.first()
        provideContent {
            val current by state.collectAsState(initial)
            WidgetTheme { TodayWidgetContent(current) }
        }
    }

    /** The widget picker's sample (Android 15+, see `WidgetPreviews`). */
    override suspend fun providePreview(context: Context, widgetCategory: Int) {
        val state = TodayWidgetState.Tracking(PreviewHabits.DAY, PreviewHabits.today(context))
        provideContent { WidgetTheme { TodayWidgetContent(state, showDate = false) } }
    }
}

class TodayWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TodayWidget()
}
