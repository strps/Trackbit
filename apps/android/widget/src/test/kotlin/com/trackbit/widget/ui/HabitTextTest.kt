package com.trackbit.widget.ui

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import com.trackbit.core.data.HabitTimer
import com.trackbit.core.model.HabitType
import com.trackbit.widget.DAY
import com.trackbit.widget.habit
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.Instant

@RunWith(RobolectricTestRunner::class)
class HabitTextTest {
    private val context: Context = ApplicationProvider.getApplicationContext()

    @Test fun `a running timer is followed by its goal and streak`() {
        val running = habit(1, type = HabitType.Timed, goal = 600_000, streak = 3, timer = HabitTimer(Instant.now(), DAY))
        assertEquals(" / 10:00 · 3 day streak", running.timerSuffix(context))
    }

    @Test fun `a timer logging to another day leaves out the goal`() {
        val running = habit(1, type = HabitType.Timed, goal = 600_000, timer = HabitTimer(Instant.now(), DAY.minusDays(1)))
        assertEquals("", running.timerSuffix(context))
    }
}
