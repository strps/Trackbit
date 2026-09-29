package com.trackbit.widget.today

import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.testing.unit.hasRunCallbackClickAction
import androidx.glance.appwidget.testing.unit.hasStartActivityClickAction
import androidx.glance.appwidget.testing.unit.runGlanceAppWidgetUnitTest
import androidx.glance.testing.unit.hasAnyDescendant
import androidx.glance.testing.unit.hasClickAction
import androidx.glance.testing.unit.hasContentDescriptionEqualTo
import androidx.glance.testing.unit.hasText
import androidx.glance.testing.unit.hasTextEqualTo
import androidx.test.core.app.ApplicationProvider
import com.trackbit.core.model.HabitType
import com.trackbit.widget.DAY
import com.trackbit.core.data.HabitTimer
import com.trackbit.widget.action.IncrementHabitAction
import com.trackbit.widget.action.StartTimerAction
import com.trackbit.widget.action.StopTimerAction
import com.trackbit.widget.action.habitParameters
import com.trackbit.widget.habit
import com.trackbit.widget.registerLauncherActivity
import com.trackbit.widget.ui.WidgetTheme
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class TodayWidgetContentTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private lateinit var launchIntent: Intent

    @Before fun registerLauncher() {
        launchIntent = registerLauncherActivity(context)
    }

    private fun render(state: TodayWidgetState, test: androidx.glance.appwidget.testing.unit.GlanceAppWidgetUnitTest.() -> Unit) =
        runGlanceAppWidgetUnitTest {
            setContext(context)
            provideComposable { WidgetTheme { TodayWidgetContent(state) } }
            test()
        }

    @Test fun `signed out asks to sign in and opens the app`() = render(TodayWidgetState.SignedOut) {
        onNode(hasStartActivityClickAction(launchIntent) and hasAnyDescendant(hasText("Sign in to Trackbit"))).assertExists()
    }

    @Test fun `no habits says so and opens the app`() = render(TodayWidgetState.Tracking(DAY, emptyList())) {
        onNode(hasStartActivityClickAction(launchIntent) and hasAnyDescendant(hasText("No habits found"))).assertExists()
    }

    @Test fun `a count habit logs +1 on the day its row shows`() {
        val water = habit(1, value = 1, goal = 8, streak = 3)
        render(TodayWidgetState.Tracking(DAY, listOf(water))) {
            onNode(hasTextEqualTo("Habit 1")).assertExists()
            onNode(hasTextEqualTo("1 / 8 · 3 day streak")).assertExists()
            onNode(
                hasRunCallbackClickAction<IncrementHabitAction>(habitParameters(water)) and
                    hasAnyDescendant(hasContentDescriptionEqualTo("Add 1 to Habit 1")),
            ).assertExists()
        }
    }

    @Test fun `a frozen habit shows a lock and has no action`() {
        val frozen = habit(1, frozen = true)
        render(TodayWidgetState.Tracking(DAY, listOf(frozen))) {
            onNode(hasContentDescriptionEqualTo("Frozen")).assertExists()
            onNode(hasContentDescriptionEqualTo("Add 1 to Habit 1")).assertDoesNotExist()
            onAllNodes(hasClickAction() and hasAnyDescendant(hasTextEqualTo("Habit 1"))).assertCountEquals(0)
        }
    }

    @Test fun `a timed habit starts its timer, and a running one stops it`() {
        val idle = habit(1, type = HabitType.Timed, goal = 600_000)
        val running = habit(2, type = HabitType.Timed, goal = 600_000, streak = 3, timer = HabitTimer(Instant.now(), DAY))
        render(TodayWidgetState.Tracking(DAY, listOf(idle, running))) {
            onNode(
                hasRunCallbackClickAction<StartTimerAction>(habitParameters(idle)) and
                    hasAnyDescendant(hasContentDescriptionEqualTo("Start the timer for Habit 1")),
            ).assertExists()
            onNode(hasTextEqualTo("0:00 / 10:00")).assertExists()
            onNode(
                hasRunCallbackClickAction<StopTimerAction>(habitParameters(running)) and
                    hasAnyDescendant(hasContentDescriptionEqualTo("Stop the timer for Habit 2")),
            ).assertExists()
        }
    }

    @Test fun `a habit the widget can't log opens the app`() {
        val workout = habit(1, type = HabitType.Complex)
        render(TodayWidgetState.Tracking(DAY, listOf(workout))) {
            onNode(hasStartActivityClickAction(launchIntent) and hasAnyDescendant(hasTextEqualTo("Habit 1"))).assertExists()
        }
    }

    @Test fun `anti-habits come after a header`() {
        render(TodayWidgetState.Tracking(DAY, listOf(habit(2, isAntiHabit = true), habit(1)))) {
            onNode(hasTextEqualTo("Anti-Habits")).assertExists()
        }
    }
}
