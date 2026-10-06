package com.trackbit.core.data

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.sync.SyncScheduler
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.model.CheckRequest
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.CreateExerciseLogRequest
import com.trackbit.core.model.CreatePerformanceRequest
import com.trackbit.core.model.CreateSessionRequest
import com.trackbit.core.model.DayLog
import com.trackbit.core.model.DaysResponse
import com.trackbit.core.model.EnsureDayLogRequest
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseLog
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.ExercisePerformance
import com.trackbit.core.model.ExerciseRequest
import com.trackbit.core.model.ExerciseSession
import com.trackbit.core.model.ExerciseSessionDetail
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitSetsResponse
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.model.LastPerformance
import com.trackbit.core.model.MuscleGroup
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.model.RecentDay
import com.trackbit.core.model.ResolvedQueue
import com.trackbit.core.model.Rgba
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.SetValues
import com.trackbit.core.model.SourceCapabilities
import com.trackbit.core.model.TodayHabit
import com.trackbit.core.model.TodayResponse
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.IdempotencyKey
import com.trackbit.core.network.SessionTokenSource
import com.trackbit.core.network.service.ExerciseService
import com.trackbit.core.network.service.TrackerService
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.yield
import okhttp3.ResponseBody.Companion.toResponseBody
import retrofit2.HttpException
import retrofit2.Response

val DAY: LocalDate = LocalDate.of(2026, 9, 26)

// Fixtures are numbered for readability; these are the uuids the app names them by.
fun h(n: Int) = "habit-$n"
fun ex(n: Int) = "exercise-$n"
fun item(n: Int) = "item-$n"
fun lst(n: Int) = "list-$n"

fun inMemoryDatabase(): TrackbitDatabase = Room
    .inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), TrackbitDatabase::class.java)
    .allowMainThreadQueries()
    .build()

fun todayHabit(
    n: Int,
    type: HabitType = HabitType.Count,
    isAntiHabit: Boolean = false,
    frozen: Boolean = false,
    firstLogDay: LocalDate? = null,
    streakBeforeDay: Int = 0,
    recent: List<RecentDay> = emptyList(),
) = TodayHabit(
    uuid = h(n),
    name = "Habit $n",
    description = null,
    type = type,
    isAntiHabit = isAntiHabit,
    icon = HabitIcon.Book,
    colorTheme = ColorTheme.Green,
    colorStops = listOf(ColorStop(0f, Rgba(1f, 2f, 3f, 1f))),
    dailyGoal = 2,
    weeklyGoal = 5,
    order = n,
    frozen = frozen,
    firstLogDay = firstLogDay,
    streakBeforeDay = streakBeforeDay,
    recent = recent,
)

fun todayResponse(day: LocalDate = DAY, vararg habits: TodayHabit) = TodayResponse(day, habits.toList())

fun dayLog(habitUuid: String, day: LocalDate, rating: Int?) =
    DayLog(id = 1, habitUuid = habitUuid, rating = rating, notes = null, localDay = day, timeStamp = Instant.EPOCH, createdAt = Instant.EPOCH)

fun httpError(status: Int, body: String = "{}") = HttpException(Response.error<Any>(status, body.toResponseBody()))

/** A clock that stands still until a test moves it. */
class FakeClock(var now: Instant = Instant.parse("2026-09-26T10:00:00Z")) : Clock() {
    override fun instant(): Instant = now
    override fun getZone(): ZoneId = ZoneOffset.UTC
    override fun withZone(zone: ZoneId): Clock = this

    fun advanceMs(ms: Long) {
        now = now.plusMillis(ms)
    }
}

/** Signed in as a user whose default rest is [defaultRestSeconds]. Only [state] is used. */
class FakeAuth(defaultRestSeconds: Int = SessionUser.DEFAULT_REST_SECONDS) : AuthRepository {
    override val state = MutableStateFlow<AuthState>(
        AuthState.SignedIn(
            SessionUser(
                id = "u_1", name = "cj", email = "u_1@test.local", emailVerified = true, image = null, role = "user",
                locale = "en", timezone = "UTC", unitSystem = UnitSystem.Metric,
                exerciseLogCardStyle = ExerciseLogCardStyle.Classic, preferredExerciseSource = null,
                defaultRestSeconds = defaultRestSeconds,
            ),
        ),
    )

    override suspend fun signIn(email: String, password: String): ApiResult<SessionUser> = error("unused")
    override suspend fun signUp(name: String, email: String, password: String, inviteCode: String?): ApiResult<Unit> = error("unused")
    override suspend fun requestPasswordReset(email: String): ApiResult<Unit> = error("unused")
    override suspend fun resendVerificationEmail(email: String): ApiResult<Unit> = error("unused")
    override suspend fun signOut() = error("unused")
    override suspend fun refresh() = error("unused")
}

class FakeTokens(var token: String? = "t1") : SessionTokenSource {
    override fun currentToken() = token
    override fun onUnauthorized(rejectedToken: String) {}
}

class FakeScheduler : SyncScheduler {
    var flushes = 0
    var periodic = 0
    var historySyncs = 0
    var cancelled = 0
    override fun flushOutbox() { flushes++ }
    override fun syncHistory() { historySyncs++ }
    override fun schedulePeriodicSync() { periodic++ }
    override suspend fun cancelAll() { cancelled++ }
}

/** Records every write with its key, and answers from [respond] (default: echo the change). */
class FakeTrackerService : TrackerService {
    data class Sent(val body: Any, val key: String)

    val sent = mutableListOf<Sent>()
    var todayAnswer: () -> TodayResponse = { todayResponse() }
    var respond: (Any) -> DayLog = { body ->
        when (body) {
            is CheckRequest -> dayLog(body.habitUuid, body.day!!, body.rating)
            is IncrementRequest -> dayLog(body.habitUuid, body.day!!, body.delta)
            is EnsureDayLogRequest -> dayLog(body.habitUuid, body.day!!, null)
            else -> error("unexpected $body")
        }
    }
    val todayDays = mutableListOf<LocalDate?>()
    var daysAnswer: (LocalDate, LocalDate) -> DaysResponse = { start, end -> DaysResponse(start, end, emptyList()) }
    val daysRequests = mutableListOf<Pair<LocalDate, LocalDate>>()

    override suspend fun days(start: LocalDate, end: LocalDate): DaysResponse {
        daysRequests += start to end
        return daysAnswer(start, end)
    }

    var setsAnswer: (String) -> HabitSetsResponse = { HabitSetsResponse(it, emptyList()) }

    override suspend fun sets(habitUuid: String): HabitSetsResponse {
        yield()
        return setsAnswer(habitUuid)
    }

    override suspend fun today(day: LocalDate?): TodayResponse {
        todayDays += day
        return todayAnswer()
    }

    /** A session write the fake received; deletes and updates name their row's uuid. */
    data class Deleted(val type: String, val uuid: String)
    data class Updated(val uuid: String, val values: SetValues)

    /** Answers session writes; throw from it to fail one. */
    var sessionRespond: (Any) -> Unit = {}
    var sessionsAnswer: (String, LocalDate) -> List<ExerciseSessionDetail> = { _, _ -> emptyList() }
    val sessionsRequests = mutableListOf<Pair<String, LocalDate>>()

    override suspend fun sessions(habitUuid: String, day: LocalDate): List<ExerciseSessionDetail> {
        sessionsRequests += habitUuid to day
        return sessionsAnswer(habitUuid, day)
    }

    override suspend fun createSession(body: CreateSessionRequest, key: IdempotencyKey): ExerciseSession {
        recordSession(body, key)
        return ExerciseSession(id = 1, uuid = body.uuid, dayLogId = 1, createdAt = null)
    }

    override suspend fun deleteSession(uuid: String, key: IdempotencyKey) = recordSession(Deleted("session", uuid), key)

    override suspend fun createExerciseLog(body: CreateExerciseLogRequest, key: IdempotencyKey): ExerciseLog {
        recordSession(body, key)
        return ExerciseLog(1, body.uuid, body.exerciseUuid, 1, body.listItemUuid, null, null, null, null, null)
    }

    override suspend fun deleteExerciseLog(uuid: String, key: IdempotencyKey) = recordSession(Deleted("log", uuid), key)

    override suspend fun createPerformance(body: CreatePerformanceRequest, key: IdempotencyKey): ExercisePerformance {
        recordSession(body, key)
        return ExercisePerformance(1, body.uuid, body.number, 1, body.reps, body.weight, body.duration, body.distance, body.rpe, null)
    }

    override suspend fun updatePerformance(uuid: String, values: SetValues, key: IdempotencyKey): ExercisePerformance {
        recordSession(Updated(uuid, values), key)
        return ExercisePerformance(1, uuid, 1, 1, values.reps, values.weight, values.duration, values.distance, values.rpe, null)
    }

    override suspend fun deletePerformance(uuid: String, key: IdempotencyKey) = recordSession(Deleted("set", uuid), key)

    /** Suspends like a real call: a value an inlined lambda resumes with must not leak (see `send`). */
    private suspend fun recordSession(body: Any, key: IdempotencyKey) {
        yield()
        sent += Sent(body, key.value)
        sessionRespond(body)
    }

    override suspend fun check(body: CheckRequest, key: IdempotencyKey) = record(body, key)
    override suspend fun increment(body: IncrementRequest, key: IdempotencyKey) = record(body, key)
    override suspend fun ensureDayLog(body: EnsureDayLogRequest, key: IdempotencyKey) = record(body, key)

    private fun record(body: Any, key: IdempotencyKey): DayLog {
        sent += Sent(body, key.value)
        return respond(body)
    }
}

class FakeExerciseService(var answer: () -> List<Exercise> = { emptyList() }) : ExerciseService {
    var calls = 0
    var sourcesAnswer: () -> List<ExerciseSourceDescriptor> = { emptyList() }
    /** Answers [key]'s queue; throw [httpError] 404 for a source that no longer resolves. */
    var queueAnswer: (key: String) -> ResolvedQueue = { throw httpError(404) }

    override suspend fun exercises(): List<Exercise> {
        calls++
        yield()
        return answer()
    }

    var muscleGroupsAnswer: () -> List<MuscleGroup> = { emptyList() }
    /** Answers a create (uuid null) or an update; throw [httpError] to fail it. */
    var writeAnswer: (uuid: String?, body: ExerciseRequest) -> Exercise = { uuid, body ->
        exercise(100).copy(uuid = uuid ?: body.uuid!!, userId = "user", name = body.name, description = body.description)
    }
    val writes = mutableListOf<Pair<String?, ExerciseRequest?>>()

    override suspend fun createExercise(body: ExerciseRequest): Exercise {
        yield()
        writes += null to body
        return writeAnswer(null, body)
    }

    override suspend fun updateExercise(uuid: String, body: ExerciseRequest): Exercise {
        yield()
        writes += uuid to body
        return writeAnswer(uuid, body)
    }

    override suspend fun deleteExercise(uuid: String) {
        yield()
        writes += uuid to null
    }

    override suspend fun muscleGroups(): List<MuscleGroup> {
        yield()
        return muscleGroupsAnswer()
    }

    var sourceCalls = 0

    override suspend fun sources(): List<ExerciseSourceDescriptor> {
        sourceCalls++
        yield()
        return sourcesAnswer()
    }

    override suspend fun source(key: String): ResolvedQueue {
        yield()
        return queueAnswer(key)
    }
}

fun source(key: String, name: String = key) =
    ExerciseSourceDescriptor(key, name, nameKey = null, itemCount = null, SourceCapabilities(true, true, true, false), frozen = false)

fun queue(key: String, vararg entries: QueueEntry) =
    ResolvedQueue(source(key), entries.toList(), emptyReason = null, generatedAt = Instant.EPOCH)

fun exercise(n: Int, frozen: Boolean = false, lastPerformance: LastPerformance? = null) = Exercise(
    uuid = ex(n),
    userId = if (frozen) "user" else null,
    name = "Exercise $n",
    category = "strength",
    defaultWeightUnit = "kg",
    defaultDistanceUnit = "km",
    lastPerformance = lastPerformance,
    frozen = frozen,
)
