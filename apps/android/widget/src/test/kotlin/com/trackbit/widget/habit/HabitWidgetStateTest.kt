package com.trackbit.widget.habit

import com.trackbit.core.auth.AuthState
import com.trackbit.widget.DAY
import com.trackbit.widget.FakeTrackerRepository
import com.trackbit.widget.habit
import com.trackbit.widget.habitUuid
import com.trackbit.widget.user
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class HabitWidgetStateTest {
    private val tracker = FakeTrackerRepository()
    private val auth = MutableStateFlow<AuthState>(AuthState.Loading)
    private val day = MutableStateFlow(DAY)
    private val chosen = MutableStateFlow<String?>(null)

    @Test fun `follows the session, the chosen habit and the day`() = runTest {
        val states = mutableListOf<HabitWidgetState>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            habitWidgetState(auth, day, chosen) { id, d -> tracker.observeHabit(id, d) }.collect { states += it }
        }
        val tomorrow = DAY.plusDays(1)
        tracker.days.value = mapOf(
            DAY to listOf(habit(1), habit(2)),
            tomorrow to listOf(habit(1, day = tomorrow, value = 1)),
        )
        assertEquals("nothing while the session is loading", emptyList<HabitWidgetState>(), states)

        auth.value = AuthState.SignedIn(user())
        assertEquals(HabitWidgetState.Unconfigured, states.last())

        chosen.value = habitUuid(1)
        assertEquals(HabitWidgetState.Tracking(habit(1)), states.last())

        chosen.value = habitUuid(2)
        assertEquals("reconfigured", HabitWidgetState.Tracking(habit(2)), states.last())

        day.value = tomorrow
        assertEquals("habit 2 has no row tomorrow", HabitWidgetState.HabitRemoved, states.last())

        chosen.value = habitUuid(1)
        assertEquals(HabitWidgetState.Tracking(habit(1, day = tomorrow, value = 1)), states.last())

        auth.value = AuthState.SignedOut
        assertEquals(HabitWidgetState.SignedOut, states.last())
    }

    @Test fun `a deleted habit comes back if it reappears`() = runTest {
        val states = mutableListOf<HabitWidgetState>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            habitWidgetState(auth, day, chosen) { id, d -> tracker.observeHabit(id, d) }.collect { states += it }
        }
        auth.value = AuthState.SignedIn(user())
        chosen.value = habitUuid(1)
        tracker.days.value = mapOf(DAY to listOf(habit(1)))
        assertEquals(HabitWidgetState.Tracking(habit(1)), states.last())

        tracker.days.value = mapOf(DAY to emptyList())
        assertEquals(HabitWidgetState.HabitRemoved, states.last())

        tracker.days.value = mapOf(DAY to listOf(habit(1)))
        assertEquals(HabitWidgetState.Tracking(habit(1)), states.last())
    }
}
