package com.trackbit.widget.preview

import android.appwidget.AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN
import android.content.Context
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.PreviewSizeMode
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.composeForPreview
import androidx.glance.appwidget.provideContent
import androidx.test.core.app.ApplicationProvider
import com.trackbit.core.model.RecentDay
import com.trackbit.widget.DAY
import com.trackbit.widget.habit
import com.trackbit.widget.habit.HabitWidgetState
import com.trackbit.widget.heatmap.HeatmapWidget
import com.trackbit.widget.heatmap.HeatmapWidgetContent
import com.trackbit.widget.heatmap.HeatmapWindow
import com.trackbit.widget.quicklog.QuickLogWidget
import com.trackbit.widget.registerLauncherActivity
import com.trackbit.widget.today.TodayWidget
import com.trackbit.widget.ui.WidgetTheme
import com.trackbit.widget.ui.openAppAction
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.DayOfWeek

@RunWith(RobolectricTestRunner::class)
class WidgetPreviewsTest {
    private val context: Context = ApplicationProvider.getApplicationContext()

    @Before fun registerLauncher() {
        registerLauncherActivity(context)
    }

    /** Translating to RemoteViews is where Glance enforces its limits, e.g. ~500 views. */
    @Test fun `every widget's preview translates to RemoteViews`() = runTest {
        listOf(TodayWidget(), QuickLogWidget(), HeatmapWidget()).forEach { widget ->
            assertNotNull(widget::class.simpleName, widget.composeForPreview(context, WIDGET_CATEGORY_HOME_SCREEN))
        }
    }

    @Test fun `a heatmap with every day logged fits Glance's view limit at every size`() = runTest {
        // Three views per colored day went past the limit at 4×2 once most days were logged.
        assertNotNull(FullHeatmap().composeForPreview(context, WIDGET_CATEGORY_HOME_SCREEN))
    }

    @Test fun `the sample habit fills the heatmap's window`() {
        val window = HeatmapWindow(PreviewHabits.DAY, DayOfWeek.MONDAY)
        val water = PreviewHabits.water(context, days = window.days)
        assertEquals(window.start, water.recent.first().day)
        assertEquals(PreviewHabits.DAY, water.today.day)
        assertEquals(5, water.today.rating)
    }

    /** W3's content at its smallest and largest sizes, every day of the window logged. */
    private class FullHeatmap : GlanceAppWidget() {
        override val previewSizeMode: PreviewSizeMode =
            SizeMode.Responsive(setOf(DpSize(180.dp, 110.dp), DpSize(250.dp, 110.dp), DpSize(350.dp, 260.dp)))

        override suspend fun provideGlance(context: Context, id: GlanceId) = Unit

        override suspend fun providePreview(context: Context, widgetCategory: Int) {
            val window = HeatmapWindow(DAY, DayOfWeek.MONDAY)
            val days = List(window.days) { RecentDay(window.start.plusDays(it.toLong()), rating = 1, sessionCount = 0) }
            val state = HabitWidgetState.Tracking(habit(1, value = 1, goal = 2).copy(recent = days))
            provideContent {
                WidgetTheme { HeatmapWidgetContent(state, DayOfWeek.MONDAY, openAppAction(context)) }
            }
        }
    }
}
