package com.trackbit.widget.quicklog

import com.trackbit.core.auth.AuthState
import com.trackbit.widget.DAY
import com.trackbit.widget.FakeTrackerRepository
import com.trackbit.widget.habit
import com.trackbit.widget.user
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class QuickLogStateTest {
    private val tracker = FakeTrackerRepository()
    private val auth = MutableStateFlow<AuthState>(AuthState.Loading)
    private val day = MutableStateFlow(DAY)
    private val habitId = MutableStateFlow<Int?>(null)

    @Test fun `follows the session, the chosen habit and the day`() = runTest {
        val states = mutableListOf<QuickLogState>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            quickLogState(auth, day, tracker, habitId).collect { states += it }
        }
        val tomorrow = DAY.plusDays(1)
        tracker.days.value = mapOf(
            DAY to listOf(habit(1), habit(2)),
            tomorrow to listOf(habit(1, day = tomorrow, value = 1)),
        )
        assertEquals("nothing while the session is loading", emptyList<QuickLogState>(), states)

        auth.value = AuthState.SignedIn(user())
        assertEquals(QuickLogState.Unconfigured, states.last())

        habitId.value = 1
        assertEquals(QuickLogState.Tracking(habit(1)), states.last())

        habitId.value = 2
        assertEquals("reconfigured", QuickLogState.Tracking(habit(2)), states.last())

        day.value = tomorrow
        assertEquals("habit 2 has no row tomorrow", QuickLogState.HabitRemoved, states.last())

        habitId.value = 1
        assertEquals(QuickLogState.Tracking(habit(1, day = tomorrow, value = 1)), states.last())

        auth.value = AuthState.SignedOut
        assertEquals(QuickLogState.SignedOut, states.last())
    }

    @Test fun `a deleted habit comes back if it reappears`() = runTest {
        val states = mutableListOf<QuickLogState>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            quickLogState(auth, day, tracker, habitId).collect { states += it }
        }
        auth.value = AuthState.SignedIn(user())
        habitId.value = 1
        tracker.days.value = mapOf(DAY to listOf(habit(1)))
        assertEquals(QuickLogState.Tracking(habit(1)), states.last())

        tracker.days.value = mapOf(DAY to emptyList())
        assertEquals(QuickLogState.HabitRemoved, states.last())

        tracker.days.value = mapOf(DAY to listOf(habit(1)))
        assertEquals(QuickLogState.Tracking(habit(1)), states.last())
    }
}
