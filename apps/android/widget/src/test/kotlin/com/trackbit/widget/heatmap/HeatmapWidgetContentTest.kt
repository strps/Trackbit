package com.trackbit.widget.heatmap

import android.content.Context
import android.content.Intent
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.testing.unit.GlanceAppWidgetUnitTest
import androidx.glance.appwidget.testing.unit.hasStartActivityClickAction
import androidx.glance.appwidget.testing.unit.runGlanceAppWidgetUnitTest
import androidx.glance.testing.unit.hasAnyDescendant
import androidx.glance.testing.unit.hasClickAction
import androidx.glance.testing.unit.hasContentDescriptionEqualTo
import androidx.glance.testing.unit.hasText
import androidx.glance.testing.unit.hasTextEqualTo
import androidx.test.core.app.ApplicationProvider
import com.trackbit.widget.habit
import com.trackbit.widget.habit.HabitWidgetState
import com.trackbit.widget.registerLauncherActivity
import com.trackbit.widget.ui.WidgetTheme
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.DayOfWeek

@RunWith(RobolectricTestRunner::class)
class HeatmapWidgetContentTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private lateinit var launchIntent: Intent
    private val chooseIntent = Intent("choose-habit")

    @Before fun registerLauncher() {
        launchIntent = registerLauncherActivity(context)
    }

    private fun render(state: HabitWidgetState, test: GlanceAppWidgetUnitTest.() -> Unit) =
        runGlanceAppWidgetUnitTest {
            setContext(context)
            setAppWidgetSize(DpSize(300.dp, 178.dp))
            provideComposable {
                WidgetTheme { HeatmapWidgetContent(state, DayOfWeek.MONDAY, actionStartActivity(chooseIntent)) }
            }
            test()
        }

    @Test fun `shows the habit and opens the app, and nothing else is tappable`() {
        render(HabitWidgetState.Tracking(habit(1, value = 1, goal = 8, streak = 3))) {
            onNode(
                hasStartActivityClickAction(launchIntent) and
                    hasContentDescriptionEqualTo("Habit 1, 1 / 8 · 3 day streak") and
                    hasAnyDescendant(hasTextEqualTo("Habit 1")),
            ).assertExists()
            onNode(hasTextEqualTo("1 / 8 · 3 day streak")).assertExists()
            onAllNodes(hasClickAction()).assertCountEquals(1)
        }
    }

    @Test fun `unconfigured and removed widgets open the picker`() {
        render(HabitWidgetState.Unconfigured) {
            onNode(hasStartActivityClickAction(chooseIntent) and hasAnyDescendant(hasTextEqualTo("Choose a habit"))).assertExists()
        }
        render(HabitWidgetState.HabitRemoved) {
            onNode(hasStartActivityClickAction(chooseIntent) and hasAnyDescendant(hasText("Tap to choose another"))).assertExists()
        }
    }

    @Test fun `signed out opens the app`() {
        render(HabitWidgetState.SignedOut) {
            onNode(hasStartActivityClickAction(launchIntent) and hasAnyDescendant(hasText("Sign in"))).assertExists()
        }
    }
}
