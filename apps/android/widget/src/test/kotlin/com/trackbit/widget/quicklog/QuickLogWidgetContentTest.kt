package com.trackbit.widget.quicklog

import android.content.Context
import android.content.Intent
import androidx.compose.ui.unit.DpSize
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.testing.unit.GlanceAppWidgetUnitTest
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
import com.trackbit.core.data.HabitTimer
import com.trackbit.widget.DAY
import com.trackbit.widget.action.IncrementHabitAction
import com.trackbit.widget.action.StartTimerAction
import com.trackbit.widget.action.StopTimerAction
import com.trackbit.widget.action.ToggleHabitAction
import com.trackbit.widget.action.habitParameters
import com.trackbit.widget.habit
import com.trackbit.widget.habit.HabitWidgetState
import com.trackbit.widget.registerLauncherActivity
import com.trackbit.widget.ui.WidgetTheme
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class QuickLogWidgetContentTest {
    private val context: Context = ApplicationProvider.getApplicationContext()
    private lateinit var launchIntent: Intent
    private val chooseIntent = Intent("choose-habit")

    @Before fun registerLauncher() {
        launchIntent = registerLauncherActivity(context)
    }

    private fun render(state: HabitWidgetState, size: DpSize, test: GlanceAppWidgetUnitTest.() -> Unit) =
        runGlanceAppWidgetUnitTest {
            setContext(context)
            setAppWidgetSize(size)
            provideComposable { WidgetTheme { QuickLogWidgetContent(state, actionStartActivity(chooseIntent)) } }
            test()
        }

    @Test fun `1×1 is the ring alone, and a tap adds 1`() {
        val water = habit(1, value = 1, goal = 8, streak = 3)
        render(HabitWidgetState.Tracking(water), QuickLogWidget.SMALL) {
            onNode(
                hasRunCallbackClickAction<IncrementHabitAction>(habitParameters(water)) and
                    hasContentDescriptionEqualTo("Add 1 to Habit 1"),
            ).assertExists()
            onNode(hasTextEqualTo("Habit 1")).assertDoesNotExist()
        }
    }

    @Test fun `2×1 adds the name, progress and streak`() {
        render(HabitWidgetState.Tracking(habit(1, value = 1, goal = 8, streak = 3)), QuickLogWidget.WIDE) {
            onNode(hasTextEqualTo("Habit 1")).assertExists()
            onNode(hasTextEqualTo("1 / 8 · 3 day streak")).assertExists()
        }
    }

    @Test fun `a check habit toggles, and says which way`() {
        val done = habit(1, type = HabitType.Check, value = 1, goal = 1)
        render(HabitWidgetState.Tracking(done), QuickLogWidget.SQUARE) {
            onNode(
                hasRunCallbackClickAction<ToggleHabitAction>(habitParameters(done)) and
                    hasContentDescriptionEqualTo("Mark Habit 1 as not done"),
            ).assertExists()
            onNode(hasTextEqualTo("Habit 1")).assertExists()
        }
    }

    @Test fun `a frozen habit does nothing`() {
        render(HabitWidgetState.Tracking(habit(1, frozen = true)), QuickLogWidget.WIDE) {
            onNode(hasTextEqualTo("0 / 2 · Frozen")).assertExists()
            onAllNodes(hasClickAction()).assertCountEquals(0)
        }
    }

    @Test fun `a timed habit starts its timer at any size`() {
        val idle = habit(1, type = HabitType.Timed, goal = 600_000)
        render(HabitWidgetState.Tracking(idle), QuickLogWidget.SMALL) {
            onNode(
                hasRunCallbackClickAction<StartTimerAction>(habitParameters(idle)) and
                    hasContentDescriptionEqualTo("Start the timer for Habit 1"),
            ).assertExists()
        }
    }

    @Test fun `a running timer stops on tap`() {
        val running = habit(1, type = HabitType.Timed, goal = 600_000, timer = HabitTimer(Instant.now(), DAY))
        render(HabitWidgetState.Tracking(running), QuickLogWidget.SQUARE) {
            onNode(
                hasRunCallbackClickAction<StopTimerAction>(habitParameters(running)) and
                    hasContentDescriptionEqualTo("Stop the timer for Habit 1"),
            ).assertExists()
        }
    }

    @Test fun `a habit the widget can't log opens the app`() {
        render(HabitWidgetState.Tracking(habit(1, type = HabitType.Complex)), QuickLogWidget.WIDE) {
            onNode(hasStartActivityClickAction(launchIntent) and hasAnyDescendant(hasTextEqualTo("Habit 1"))).assertExists()
        }
    }

    @Test fun `a removed habit offers to choose another`() {
        render(HabitWidgetState.HabitRemoved, QuickLogWidget.WIDE) {
            onNode(hasStartActivityClickAction(chooseIntent) and hasAnyDescendant(hasText("Tap to choose another"))).assertExists()
        }
    }

    @Test fun `signed out at 1×1 says just enough and opens the app`() {
        render(HabitWidgetState.SignedOut, QuickLogWidget.SMALL) {
            onNode(hasStartActivityClickAction(launchIntent) and hasAnyDescendant(hasTextEqualTo("Sign in"))).assertExists()
        }
    }
}
