package com.trackbit.feature.session

import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.auth.PreferencesRepository
import com.trackbit.core.data.RestTimer
import com.trackbit.core.data.RestTimerRepository
import com.trackbit.core.data.SessionRepository
import com.trackbit.core.data.SourceQueue
import com.trackbit.core.data.SyncResult
import com.trackbit.core.data.TrackedExerciseLog
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackedSession
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.data.WriteResult
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.model.RecentDay
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.SetValues
import com.trackbit.core.model.SourceCapabilities
import com.trackbit.core.model.UnitSystem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.filterNotNull
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
import java.lang.reflect.Proxy
import java.time.Instant
import java.time.LocalDate

private val DAY: LocalDate = LocalDate.of(2026, 9, 26)

@OptIn(ExperimentalCoroutinesApi::class)
class SessionViewModelTest {
    private val sessions = FakeSessionRepository()
    private val tracker = FakeTrackerRepository()
    private val auth = FakeAuthRepository()
    private val preferences = FakePreferencesRepository(auth)
    private val restTimers = FakeRestTimerRepository()

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    /** Subscribes to [SessionViewModel.state] for the test, as the screen would. */
    private fun TestScope.subscribed(): SessionViewModel {
        val viewModel = SessionViewModel(habitId = 1, day = DAY, sessions = sessions, tracker = tracker, auth = auth, preferences = preferences, restTimers = restTimers)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.state.collect {} }
        return viewModel
    }

    @Test fun `shows the running rest and the user's default rest`() = runTest {
        auth.state.value = AuthState.SignedIn(user().copy(defaultRestSeconds = 120))
        val viewModel = subscribed()
        assertNull(viewModel.state.value.rest)
        assertEquals(120, viewModel.state.value.defaultRestSeconds)

        val rest = RestTimer(Instant.EPOCH, Instant.EPOCH.plusSeconds(120))
        restTimers.rest.value = rest
        assertEquals(rest, viewModel.state.value.rest)
    }

    @Test fun `rest controls reach the rest timer, and the default is kept in the server's range`() = runTest {
        auth.state.value = AuthState.SignedIn(user())
        val viewModel = subscribed()

        viewModel.adjustRest(-RestTimer.STEP_MS)
        viewModel.adjustRest(RestTimer.STEP_MS)
        viewModel.skipRest()
        assertEquals(listOf<Any>(-15_000L, 15_000L, "skip"), restTimers.calls)

        viewModel.setDefaultRest(150)
        assertEquals(150, viewModel.state.value.defaultRestSeconds)
        viewModel.setDefaultRest(99_999)
        assertEquals(3600, viewModel.state.value.defaultRestSeconds)
    }

    @Test fun `shows the habit's sessions on its day with the catalog and the user's preferences`() = runTest {
        tracker.habit.value = habit()
        sessions.sessions.value = listOf(session("s-1"))
        sessions.exercises.value = listOf(exercise(10))
        auth.state.value = AuthState.SignedIn(user(UnitSystem.Imperial, ExerciseLogCardStyle.Compact))

        val state = subscribed().state.value

        assertEquals(listOf(1 to DAY), sessions.observed)
        assertEquals("Gym", state.habit?.name)
        assertEquals(listOf("s-1"), state.sessions?.map { it.id })
        assertEquals("Exercise 10", state.exercise(10)?.name)
        assertNull(state.exercise(11))
        assertEquals(UnitSystem.Imperial, state.unitSystem)
        assertEquals(ExerciseLogCardStyle.Compact, state.cardStyle)
        assertFalse(state.readOnly)
    }

    @Test fun `unknown preferences read as the web's defaults`() = runTest {
        auth.state.value = AuthState.SignedIn(user(UnitSystem.Unknown, ExerciseLogCardStyle.Unknown))
        val state = subscribed().state.value
        assertEquals(UnitSystem.Metric, state.unitSystem)
        assertEquals(ExerciseLogCardStyle.Classic, state.cardStyle)
    }

    @Test fun `loading until Room answers, and a frozen habit is read-only`() = runTest {
        val viewModel = subscribed()
        assertNull(viewModel.state.value.sessions)

        sessions.sessions.value = emptyList()
        tracker.habit.value = habit(frozen = true)
        assertEquals(emptyList<TrackedSession>(), viewModel.state.value.sessions)
        assertTrue(viewModel.state.value.readOnly)
    }

    @Test fun `opening refreshes the day, and a failed refresh says so until shown`() = runTest {
        sessions.refreshResult = SyncResult.Retry
        val viewModel = subscribed()
        assertEquals(listOf(1 to DAY), sessions.refreshes)
        assertEquals(SessionMessage.Offline, viewModel.state.value.message)
        assertFalse(viewModel.state.value.refreshing)

        viewModel.onMessageShown(SessionMessage.SyncFailed)
        assertEquals("only the shown message clears", SessionMessage.Offline, viewModel.state.value.message)
        viewModel.onMessageShown(SessionMessage.Offline)
        assertNull(viewModel.state.value.message)
    }

    @Test fun `writes name their rows and the habit's day`() = runTest {
        val viewModel = subscribed()
        val values = SetValues(reps = 8, weight = 60.0, duration = null, distance = null, rpe = 7)

        viewModel.startSession()
        viewModel.addExercise("s-1", 10, listItemId = 4)
        viewModel.addSet("l-1")
        viewModel.updateSet("p-1", values)
        viewModel.deleteSet("p-1")
        viewModel.removeExercise("l-1")
        viewModel.deleteSession("s-1")

        assertEquals(
            listOf("start 1 $DAY", "add s-1 10 4", "set l-1", "update p-1 $values", "delete set p-1", "remove l-1", "delete s-1"),
            sessions.writes,
        )
        assertNull(viewModel.state.value.message)
    }

    @Test fun `the preferred source resolves through the sources, and its queue is pulled`() = runTest {
        sessions.sources.value = listOf(source("list:1"), source("list:2"))
        sessions.queues["list:2"] = MutableStateFlow(SourceQueue.Resolved(listOf(QueueEntry(10, 0, 4, null)), null))
        auth.state.value = AuthState.SignedIn(user(preferredSource = "list:2"))

        val viewModel = subscribed()
        assertEquals("list:2", viewModel.state.value.source?.key)
        assertEquals(SourceQueue.Resolved(listOf(QueueEntry(10, 0, 4, null)), null), viewModel.state.value.queue)
        assertEquals("once on open", listOf("list:2"), sessions.queueRefreshes)

        viewModel.selectSource("list:1")
        assertEquals(listOf("list:1"), preferences.set)
        assertEquals("list:1", viewModel.state.value.source?.key)
        assertNull("never pulled", viewModel.state.value.queue)
        assertEquals(listOf("list:2", "list:1"), sessions.queueRefreshes)

        viewModel.refresh()
        assertEquals("pull-to-refresh reloads the queue", listOf("list:2", "list:1", "list:1"), sessions.queueRefreshes)

        viewModel.selectSource(null)
        assertNull(viewModel.state.value.source)
        assertNull(viewModel.state.value.queue)
    }

    @Test fun `a preferred key no source has is browse mode, and is cleared once a pull confirms it`() = runTest {
        // Room's copy predates the list: until this screen's pull answers, the key is kept.
        sessions.sources.value = listOf(source("list:1"))
        sessions.refreshResult = SyncResult.Retry
        auth.state.value = AuthState.SignedIn(user(preferredSource = "list:9"))

        val viewModel = subscribed()
        assertNull(viewModel.state.value.source)
        assertEquals(emptyList<String?>(), preferences.set)
        assertTrue(viewModel.state.value.sourcesLoaded)

        sessions.refreshResult = SyncResult.Done
        viewModel.refresh()
        assertEquals(listOf<String?>(null), preferences.set)
        assertNull(viewModel.state.value.source)
    }

    @Test fun `no lists is only said once the sources are known`() = runTest {
        sessions.refreshResult = SyncResult.Retry
        val viewModel = subscribed()
        assertFalse(viewModel.state.value.sourcesLoaded)

        sessions.refreshResult = SyncResult.Done
        viewModel.refresh()
        assertTrue(viewModel.state.value.sourcesLoaded)
    }

    @Test fun `refused writes report why`() = runTest {
        val viewModel = subscribed()
        sessions.writeResult = WriteResult.ExerciseFrozen
        viewModel.addSet("l-1")
        assertEquals(SessionMessage.ExerciseFrozen, viewModel.state.value.message)

        sessions.writeResult = WriteResult.HabitFrozen
        viewModel.startSession()
        assertEquals(SessionMessage.HabitFrozen, viewModel.state.value.message)
    }
}

private fun habit(frozen: Boolean = false) = TrackedHabit(
    id = 1,
    name = "Gym",
    description = null,
    type = HabitType.Complex,
    isAntiHabit = false,
    icon = HabitIcon.Book,
    colorTheme = ColorTheme.Green,
    colorStops = emptyList(),
    dailyGoal = 1,
    weeklyGoal = 3,
    frozen = frozen,
    day = DAY,
    recent = listOf(RecentDay(DAY, rating = null, sessionCount = 0)),
    progress = HabitProgress(value = 0, goal = 1, isAntiHabit = false),
    streak = 0,
)

private fun session(id: String, logs: List<TrackedExerciseLog> = emptyList()) =
    TrackedSession(id = id, habitId = 1, day = DAY, createdAt = Instant.EPOCH, logs = logs)

private fun exercise(id: Int) = Exercise(
    id = id, userId = null, name = "Exercise $id", category = "strength",
    defaultWeightUnit = "kg", defaultDistanceUnit = "km", lastPerformance = null,
)

private fun user(
    units: UnitSystem = UnitSystem.Metric,
    style: ExerciseLogCardStyle = ExerciseLogCardStyle.Classic,
    preferredSource: String? = null,
) = SessionUser(
    id = "u1", name = "Ana", email = "ana@example.com", emailVerified = true, image = null,
    role = "user", locale = "en", timezone = "UTC", unitSystem = units,
    exerciseLogCardStyle = style, preferredExerciseSource = preferredSource,
)

private fun source(key: String) =
    ExerciseSourceDescriptor(key, name = key, nameKey = null, itemCount = 1, SourceCapabilities(true, true, false, false), frozen = false)

/** An [T] whose every member fails: fakes override only what the view model uses. */
private inline fun <reified T> unused(): T = Proxy.newProxyInstance(T::class.java.classLoader, arrayOf(T::class.java)) { _, method, _ ->
    error("${method.name} is not part of this test")
} as T

private class FakeSessionRepository : SessionRepository by unused() {
    val sessions = MutableStateFlow<List<TrackedSession>?>(null)
    val exercises = MutableStateFlow<List<Exercise>>(emptyList())
    val observed = mutableListOf<Pair<Int, LocalDate>>()
    val refreshes = mutableListOf<Pair<Int, LocalDate>>()
    var refreshResult = SyncResult.Done
    val writes = mutableListOf<String>()
    var writeResult = WriteResult.Queued

    override fun observeSessions(habitId: Int, day: LocalDate): Flow<List<TrackedSession>> {
        observed += habitId to day
        // Room hasn't answered until the test sets a value.
        return sessions.filterNotNull()
    }

    override fun observeExercises(): Flow<List<Exercise>> = exercises

    val sources = MutableStateFlow<List<ExerciseSourceDescriptor>>(emptyList())
    val queues = mutableMapOf<String, MutableStateFlow<SourceQueue?>>()
    val queueRefreshes = mutableListOf<String>()

    override fun observeSources(): Flow<List<ExerciseSourceDescriptor>> = sources

    override fun observeQueue(key: String): Flow<SourceQueue?> = queues.getOrPut(key) { MutableStateFlow(null) }

    override suspend fun refreshQueue(key: String): SyncResult {
        queueRefreshes += key
        return SyncResult.Done
    }

    override suspend fun refresh(habitId: Int, day: LocalDate): SyncResult {
        refreshes += habitId to day
        return refreshResult
    }

    private fun write(entry: String): WriteResult {
        writes += entry
        return writeResult
    }

    override suspend fun startSession(habitId: Int, day: LocalDate) = write("start $habitId $day")
    override suspend fun deleteSession(sessionId: String) = write("delete $sessionId")
    override suspend fun addExercise(sessionId: String, exerciseId: Int, listItemId: Int?) = write("add $sessionId $exerciseId $listItemId")
    override suspend fun removeExercise(logId: String) = write("remove $logId")
    override suspend fun addSet(logId: String) = write("set $logId")
    override suspend fun updateSet(setId: String, values: SetValues) = write("update $setId $values")
    override suspend fun deleteSet(setId: String) = write("delete set $setId")
}

private class FakeTrackerRepository : TrackerRepository by unused() {
    val habit = MutableStateFlow<TrackedHabit?>(null)

    override fun observeHabit(habitId: Int, day: LocalDate, days: Int): Flow<TrackedHabit?> = habit
}

private class FakeAuthRepository : AuthRepository by unused() {
    override val state = MutableStateFlow<AuthState>(AuthState.SignedOut)
}

/** Changes the signed-in user's preference, as the real one does in the cached session. */
private class FakePreferencesRepository(private val auth: FakeAuthRepository) : PreferencesRepository {
    val set = mutableListOf<String?>()

    override suspend fun setPreferredExerciseSource(key: String?) {
        set += key
        val user = (auth.state.value as? AuthState.SignedIn)?.user ?: return
        auth.state.value = AuthState.SignedIn(user.copy(preferredExerciseSource = key))
    }

    override suspend fun setDefaultRestSeconds(seconds: Int) {
        val user = (auth.state.value as? AuthState.SignedIn)?.user ?: return
        auth.state.value = AuthState.SignedIn(user.copy(defaultRestSeconds = seconds))
    }
}

private class FakeRestTimerRepository : RestTimerRepository by unused() {
    val rest = MutableStateFlow<RestTimer?>(null)
    val calls = mutableListOf<Any>()

    override fun observe(): Flow<RestTimer?> = rest

    override suspend fun adjust(ms: Long) {
        calls += ms
    }

    override suspend fun skip() {
        calls += "skip"
    }
}
