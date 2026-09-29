package com.trackbit.feature.tracker

import com.trackbit.core.data.SyncResult
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.data.WriteResult
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.RecentDay
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate

private val DAY: LocalDate = LocalDate.of(2026, 9, 26)

@OptIn(ExperimentalCoroutinesApi::class)
class TodayViewModelTest {
    private val tracker = FakeTrackerRepository()
    private val clock = FakeDayClock(DAY)

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    /** Subscribes to [TodayViewModel.state] for the test, as the screen would. */
    private fun TestScope.subscribed(): TodayViewModel {
        val viewModel = TodayViewModel(tracker, clock)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.state.collect {} }
        return viewModel
    }

    @Test fun `shows the clock's day and follows it past midnight`() = runTest {
        tracker.habits.value = listOf(habit(1))
        val viewModel = subscribed()
        assertEquals(DAY, viewModel.state.value.day)
        assertEquals(listOf(DAY), viewModel.state.value.habits!!.map { it.day })

        clock.today.value = DAY.plusDays(1)
        assertEquals(DAY.plusDays(1), viewModel.state.value.day)
        assertEquals(listOf(DAY.plusDays(1)), viewModel.state.value.habits!!.map { it.day })
    }

    @Test fun `writes go to the day the row shows`() = runTest {
        val viewModel = subscribed()
        viewModel.increment(habit(1, day = DAY.minusDays(1)))
        viewModel.toggle(habit(2, type = HabitType.Check))
        assertEquals(listOf("increment 1 ${DAY.minusDays(1)} 1", "toggle 2 $DAY"), tracker.writes)
    }

    @Test fun `a frozen habit reports a message until it is shown`() = runTest {
        tracker.writeResult = WriteResult.HabitFrozen
        val viewModel = subscribed()
        viewModel.increment(habit(1))
        assertEquals(TodayMessage.HabitFrozen, viewModel.state.value.message)

        viewModel.onMessageShown(TodayMessage.Offline)
        assertEquals(TodayMessage.HabitFrozen, viewModel.state.value.message)
        viewModel.onMessageShown(TodayMessage.HabitFrozen)
        assertNull(viewModel.state.value.message)
    }

    @Test fun `refreshes when opened and reports being offline`() = runTest {
        val viewModel = subscribed()
        assertEquals(1, tracker.refreshes)
        assertTrue(viewModel.state.value.refreshing)

        tracker.refreshResult.complete(SyncResult.Retry)
        assertFalse(viewModel.state.value.refreshing)
        assertEquals(TodayMessage.Offline, viewModel.state.value.message)
    }

    @Test fun `a pull while refreshing doesn't start another`() = runTest {
        val viewModel = subscribed()
        viewModel.refresh()
        assertEquals(1, tracker.refreshes)
    }

    @Test fun `a signed-out refresh shows no message, since routing takes over`() = runTest {
        val viewModel = subscribed()
        tracker.refreshResult.complete(SyncResult.SignedOut)
        assertNull(viewModel.state.value.message)
    }

    @Test fun `shows pending writes`() = runTest {
        val viewModel = subscribed()
        tracker.pendingWrites.value = 3
        assertEquals(3, viewModel.state.value.pendingWrites)
    }
}

private fun habit(id: Int, type: HabitType = HabitType.Count, day: LocalDate = DAY) = TrackedHabit(
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
    day = day,
    recent = listOf(RecentDay(day, rating = null, sessionCount = 0)),
    progress = HabitProgress(value = 0, goal = 2, isAntiHabit = false),
    streak = 0,
)

private class FakeDayClock(day: LocalDate) : DayClock {
    override val today = MutableStateFlow(day)
}

private class FakeTrackerRepository : TrackerRepository {
    /** Habits as they'd be on any day; [observeDay] stamps the requested day on them. */
    val habits = MutableStateFlow<List<TrackedHabit>>(emptyList())
    override val pendingWrites = MutableStateFlow(0)
    override val changes = emptyFlow<Unit>()
    val writes = mutableListOf<String>()
    var writeResult = WriteResult.Queued
    var refreshes = 0
    val refreshResult = CompletableDeferred<SyncResult>()

    override fun observeDay(day: LocalDate): Flow<List<TrackedHabit>> =
        habits.map { list -> list.map { it.copy(day = day) } }

    override fun observeHabit(habitId: Int, day: LocalDate): Flow<TrackedHabit?> =
        observeDay(day).map { list -> list.find { it.id == habitId } }

    override suspend fun setRating(habitId: Int, day: LocalDate, rating: Int) = record("set $habitId $day $rating")

    override suspend fun increment(habitId: Int, day: LocalDate, delta: Int) =
        record("increment $habitId $day $delta")

    override suspend fun toggle(habitId: Int, day: LocalDate) = record("toggle $habitId $day")

    override suspend fun ensureDayLog(habitId: Int, day: LocalDate) = record("ensure $habitId $day")

    override suspend fun refresh(): SyncResult {
        refreshes++
        return refreshResult.await()
    }

    private fun record(write: String): WriteResult {
        writes += write
        return writeResult
    }
}
