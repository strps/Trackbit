package com.trackbit.feature.tracker

import androidx.lifecycle.SavedStateHandle
import com.trackbit.core.data.DayClock
import com.trackbit.core.data.HabitTimer
import com.trackbit.core.data.RECENT_DAYS
import com.trackbit.core.data.STREAK_DAYS
import com.trackbit.core.data.SyncResult
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.data.WriteResult
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.HistoryOwner
import com.trackbit.core.model.RecentDay
import java.time.Instant
import java.time.LocalDate
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

private val DAY: LocalDate = LocalDate.of(2026, 9, 26)

@OptIn(ExperimentalCoroutinesApi::class)
class TrackerViewModelTest {
    private val tracker = FakeTrackerRepository()
    private val clock = FakeDayClock(DAY)

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    /** Subscribes to [TrackerViewModel.state] for the test, as the screen would. */
    private fun TestScope.subscribed(savedState: SavedStateHandle = SavedStateHandle()): TrackerViewModel {
        val viewModel = TrackerViewModel(tracker, clock, savedState)
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
        assertEquals(TrackerMessage.HabitFrozen, viewModel.state.value.message)

        viewModel.onMessageShown(TrackerMessage.Offline)
        assertEquals(TrackerMessage.HabitFrozen, viewModel.state.value.message)
        viewModel.onMessageShown(TrackerMessage.HabitFrozen)
        assertNull(viewModel.state.value.message)
    }

    @Test fun `refreshes when opened and reports being offline`() = runTest {
        val viewModel = subscribed()
        assertEquals(1, tracker.refreshes)
        assertTrue(viewModel.state.value.refreshing)

        tracker.refreshResult.complete(SyncResult.Retry)
        assertFalse(viewModel.state.value.refreshing)
        assertEquals(TrackerMessage.Offline, viewModel.state.value.message)
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

    @Test fun `a picked past day is shown with a streak window and history, until today again`() = runTest {
        tracker.habits.value = listOf(habit(1))
        val viewModel = subscribed()
        assertEquals(listOf("release"), tracker.history)
        assertEquals(DAY to RECENT_DAYS, tracker.observed.last())

        val past = DAY.minusDays(40)
        viewModel.selectDay(past)
        assertEquals(past, viewModel.state.value.day)
        assertFalse(viewModel.state.value.isToday)
        assertEquals(listOf(past), viewModel.state.value.habits!!.map { it.day })
        assertEquals(past to STREAK_DAYS, tracker.observed.last())
        assertEquals("request ${past.minusDays(STREAK_DAYS - 1L)}", tracker.history.last())

        viewModel.selectDay(DAY)
        assertTrue(viewModel.state.value.isToday)
        assertEquals(listOf("release", "request ${past.minusDays(STREAK_DAYS - 1L)}", "release"), tracker.history)
    }

    @Test fun `moving never passes today, and a picked day survives midnight`() = runTest {
        val viewModel = subscribed()
        viewModel.moveDay(1)
        assertEquals(DAY, viewModel.state.value.day)

        viewModel.moveDay(-1)
        assertEquals(DAY.minusDays(1), viewModel.state.value.day)
        clock.today.value = DAY.plusDays(1)
        assertEquals(DAY.minusDays(1), viewModel.state.value.day)

        viewModel.moveDay(1)
        viewModel.moveDay(1)
        assertTrue("today again", viewModel.state.value.isToday)
        clock.today.value = DAY.plusDays(2)
        assertEquals("follows today", DAY.plusDays(2), viewModel.state.value.day)
    }

    @Test fun `the picked day is restored with the screen`() = runTest {
        val savedState = SavedStateHandle()
        subscribed(savedState).selectDay(DAY.minusDays(3))

        assertEquals(DAY.minusDays(3), subscribed(savedState).state.value.day)
    }

    @Test fun `decrementing stops at 0`() = runTest {
        val viewModel = subscribed()
        viewModel.increment(habit(1, value = 0), -1)
        viewModel.increment(habit(2, value = 1), -1)
        assertEquals(listOf("increment 2 $DAY -1"), tracker.writes)
    }

    @Test fun `timed habits start and stop their timer, and set their time`() = runTest {
        val viewModel = subscribed()
        viewModel.toggleTimer(habit(1, type = HabitType.Timed, day = DAY.minusDays(2)))
        viewModel.toggleTimer(habit(1, type = HabitType.Timed, timer = HabitTimer(Instant.EPOCH, DAY)))
        viewModel.setTime(habit(1, type = HabitType.Timed), 90_000)
        assertEquals(listOf("start 1 ${DAY.minusDays(2)}", "stop 1", "set 1 $DAY 90000"), tracker.writes)
    }
}

private fun habit(
    id: Int,
    type: HabitType = HabitType.Count,
    day: LocalDate = DAY,
    value: Long = 0,
    timer: HabitTimer? = null,
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
    day = day,
    recent = listOf(RecentDay(day, rating = null, sessionCount = 0)),
    progress = HabitProgress(value = value, goal = 2, isAntiHabit = false),
    streak = 0,
    timer = timer,
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

    /** Every [observeDay] call: the day and how many days. */
    val observed = mutableListOf<Pair<LocalDate, Int>>()

    /** History requests and releases, in order: "request <start>" or "release". */
    val history = mutableListOf<String>()

    override fun observeDay(day: LocalDate, days: Int): Flow<List<TrackedHabit>> {
        observed += day to days
        return habits.map { list -> list.map { it.copy(day = day) } }
    }

    override fun observeHabit(habitId: Int, day: LocalDate, days: Int): Flow<TrackedHabit?> =
        observeDay(day, days).map { list -> list.find { it.id == habitId } }

    override suspend fun setRating(habitId: Int, day: LocalDate, rating: Int) = record("set $habitId $day $rating")

    override suspend fun increment(habitId: Int, day: LocalDate, delta: Int) =
        record("increment $habitId $day $delta")

    override suspend fun toggle(habitId: Int, day: LocalDate) = record("toggle $habitId $day")

    override suspend fun ensureDayLog(habitId: Int, day: LocalDate) = record("ensure $habitId $day")

    override fun observeRunningTimers(): Flow<List<TrackedHabit>> = throw UnsupportedOperationException()
    override suspend fun requestHistory(owner: HistoryOwner, start: LocalDate) {
        check(owner == HistoryOwner.Tracker)
        history += "request $start"
    }

    override suspend fun releaseHistory(owner: HistoryOwner) {
        check(owner == HistoryOwner.Tracker)
        history += "release"
    }

    override suspend fun startTimer(habitId: Int, day: LocalDate) = record("start $habitId $day")

    override suspend fun stopTimer(habitId: Int) = record("stop $habitId")

    override suspend fun addToTimer(habitId: Int, ms: Long) = record("add $habitId $ms")

    override suspend fun refresh(): SyncResult {
        refreshes++
        return refreshResult.await()
    }

    private fun record(write: String): WriteResult {
        writes += write
        return writeResult
    }
}
