package com.trackbit.widget.today

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

class TodayWidgetStateTest {
    private val tracker = FakeTrackerRepository()
    private val auth = MutableStateFlow<AuthState>(AuthState.Loading)
    private val day = MutableStateFlow(DAY)

    @Test fun `follows the session and the day, with each day's own habits`() = runTest {
        val states = mutableListOf<TodayWidgetState>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            todayWidgetState(auth, day, tracker).collect { states += it }
        }
        val tomorrow = DAY.plusDays(1)
        tracker.days.value = mapOf(DAY to listOf(habit(1)), tomorrow to listOf(habit(1, day = tomorrow, value = 1)))
        assertEquals("nothing while the session is loading", emptyList<TodayWidgetState>(), states)

        auth.value = AuthState.SignedIn(user())
        assertEquals(TodayWidgetState.Tracking(DAY, listOf(habit(1))), states.last())

        day.value = tomorrow
        assertEquals(TodayWidgetState.Tracking(tomorrow, listOf(habit(1, day = tomorrow, value = 1))), states.last())

        auth.value = AuthState.SignedOut
        assertEquals(TodayWidgetState.SignedOut, states.last())
    }
}
