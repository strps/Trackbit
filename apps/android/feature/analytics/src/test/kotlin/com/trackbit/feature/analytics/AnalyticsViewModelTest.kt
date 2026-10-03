package com.trackbit.feature.analytics

import androidx.lifecycle.SavedStateHandle
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.AnalyticsRepository
import com.trackbit.core.data.DayClock
import com.trackbit.core.data.SessionRepository
import com.trackbit.core.data.SyncResult
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.HabitSet
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.HistoryOwner
import com.trackbit.core.model.RecentDay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import java.lang.reflect.Proxy
import java.time.LocalDate

private val DAY: LocalDate = LocalDate.of(2026, 10, 3)

@OptIn(ExperimentalCoroutinesApi::class)
class AnalyticsViewModelTest {
    private val tracker = FakeTrackerRepository()
    private val analytics = FakeAnalyticsRepository()

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    private fun TestScope.subscribed(savedState: SavedStateHandle = SavedStateHandle()): AnalyticsViewModel {
        val viewModel = AnalyticsViewModel(tracker, analytics, FakeSessionRepository(), FakeAuthRepository(), FakeDayClock(DAY), savedState)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.state.collect {} }
        return viewModel
    }

    @Test fun `history reaches back to the earliest first log, after releasing a leftover request`() = runTest {
        tracker.habits.value = listOf(habit(1, firstLogDay = DAY.minusDays(30)), habit(2, firstLogDay = DAY.minusYears(3)))
        subscribed()
        assertEquals(listOf("release", "request ${DAY.minusYears(3)}"), tracker.history)

        // Without old logs, the heatmap's year is still kept.
        tracker.habits.value = listOf(habit(1, firstLogDay = DAY.minusDays(30)))
        assertEquals("request ${DAY.minusDays(AnalyticsViewModel.HEATMAP_DAYS - 1L)}", tracker.history.last())
    }

    @Test fun `the first habit is shown until one is picked, and the pick is restored`() = runTest {
        tracker.habits.value = listOf(habit(1), habit(2))
        val savedState = SavedStateHandle()
        val viewModel = subscribed(savedState)
        assertEquals(1, viewModel.state.value.habit!!.id)

        viewModel.selectHabit(2)
        assertEquals(2, viewModel.state.value.habit!!.id)
        assertEquals(2, subscribed(savedState).state.value.habit!!.id)
    }

    @Test fun `a habit reads its days back to its first log, or a year`() = runTest {
        tracker.habits.value = listOf(habit(1, firstLogDay = DAY.minusDays(999)), habit(2, firstLogDay = DAY.minusDays(3)))
        val viewModel = subscribed()
        assertEquals(1000, tracker.observedHabits.last())

        viewModel.selectHabit(2)
        assertEquals(AnalyticsViewModel.HEATMAP_DAYS, tracker.observedHabits.last())
    }

    @Test fun `stats wait until every log is known`() = runTest {
        tracker.habits.value = listOf(habit(1, firstLogDay = DAY.minusDays(30), logsKnownFrom = DAY.minusDays(6)))
        val viewModel = subscribed()
        assertNull(viewModel.state.value.stats)

        tracker.habits.value = listOf(habit(1, firstLogDay = DAY.minusDays(30), logsKnownFrom = DAY.minusDays(400)))
        assertEquals(HabitStats(totalCompletions = 1, currentStreak = 1, goalFrequencyPercent = 100), viewModel.state.value.stats)
    }

    @Test fun `a workout habit's sets are pulled when it is picked, and again on refresh`() = runTest {
        tracker.habits.value = listOf(habit(1), habit(2, type = HabitType.Complex))
        val viewModel = subscribed()
        assertEquals(emptyList<Int>(), analytics.refreshed)
        assertNull(viewModel.state.value.sets)

        viewModel.selectHabit(2)
        assertEquals(listOf(2), analytics.refreshed)
        assertEquals(emptyList<HabitSet>(), viewModel.state.value.sets)

        analytics.result = SyncResult.Retry
        viewModel.refresh()
        assertEquals(listOf(2, 2), analytics.refreshed)
        assertEquals(1, tracker.refreshes)
        assertEquals(AnalyticsMessage.Offline, viewModel.state.value.message)
    }
}

private fun habit(
    id: Int,
    type: HabitType = HabitType.Count,
    firstLogDay: LocalDate? = DAY,
    logsKnownFrom: LocalDate = DAY.minusDays(400),
) = TrackedHabit(
    id = id,
    name = "Habit $id",
    description = null,
    type = type,
    isAntiHabit = false,
    icon = HabitIcon.Book,
    colorTheme = ColorTheme.Green,
    colorStops = emptyList(),
    dailyGoal = 2,
    weeklyGoal = 5,
    frozen = false,
    day = DAY,
    recent = listOf(RecentDay(DAY, rating = 2, sessionCount = 0)),
    progress = HabitProgress(value = 2, goal = 2, isAntiHabit = false),
    streak = 1,
    firstLogDay = firstLogDay,
    logsKnownFrom = logsKnownFrom,
)

private inline fun <reified T> unused(): T = Proxy.newProxyInstance(T::class.java.classLoader, arrayOf(T::class.java)) { _, method, _ ->
    error("${method.name} is not part of this test")
} as T

private class FakeDayClock(day: LocalDate) : DayClock {
    override val today = MutableStateFlow(day)
}

private class FakeTrackerRepository : TrackerRepository by unused() {
    val habits = MutableStateFlow<List<TrackedHabit>>(emptyList())
    val history = mutableListOf<String>()
    /** How many days each [observeHabit] asked for. */
    val observedHabits = mutableListOf<Int>()
    var refreshes = 0

    override fun observeDay(day: LocalDate, days: Int): Flow<List<TrackedHabit>> = habits

    override fun observeHabit(habitId: Int, day: LocalDate, days: Int): Flow<TrackedHabit?> {
        observedHabits += days
        return habits.map { list -> list.find { it.id == habitId } }
    }

    override suspend fun requestHistory(owner: HistoryOwner, start: LocalDate) {
        check(owner == HistoryOwner.Analytics)
        history += "request $start"
    }

    override suspend fun releaseHistory(owner: HistoryOwner) {
        check(owner == HistoryOwner.Analytics)
        history += "release"
    }

    override suspend fun refresh(): SyncResult {
        refreshes++
        return SyncResult.Done
    }
}

private class FakeAnalyticsRepository : AnalyticsRepository {
    val refreshed = mutableListOf<Int>()
    var result = SyncResult.Done

    override fun observeSets(habitId: Int): Flow<List<HabitSet>?> = MutableStateFlow(emptyList())

    override suspend fun refresh(habitId: Int): SyncResult {
        refreshed += habitId
        return result
    }
}

private class FakeSessionRepository : SessionRepository by unused() {
    override fun observeExercises(): Flow<List<Exercise>> = MutableStateFlow(emptyList())
}

private class FakeAuthRepository : AuthRepository by unused() {
    override val state = MutableStateFlow<AuthState>(AuthState.SignedOut)
}
