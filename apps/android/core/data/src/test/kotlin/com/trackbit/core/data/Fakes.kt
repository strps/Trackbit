package com.trackbit.core.data

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.trackbit.core.data.sync.SyncScheduler
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.model.CheckRequest
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.DayLog
import com.trackbit.core.model.EnsureDayLogRequest
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.model.RecentDay
import com.trackbit.core.model.Rgba
import com.trackbit.core.model.TodayHabit
import com.trackbit.core.model.TodayResponse
import com.trackbit.core.network.IdempotencyKey
import com.trackbit.core.network.SessionTokenSource
import com.trackbit.core.network.service.TrackerService
import java.time.Instant
import java.time.LocalDate

val DAY: LocalDate = LocalDate.of(2026, 9, 26)

fun inMemoryDatabase(): TrackbitDatabase = Room
    .inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), TrackbitDatabase::class.java)
    .allowMainThreadQueries()
    .build()

fun todayHabit(
    id: Int,
    type: HabitType = HabitType.Count,
    isAntiHabit: Boolean = false,
    frozen: Boolean = false,
    firstLogDay: LocalDate? = null,
    streakBeforeDay: Int = 0,
    recent: List<RecentDay> = emptyList(),
) = TodayHabit(
    id = id,
    name = "Habit $id",
    description = null,
    type = type,
    isAntiHabit = isAntiHabit,
    icon = HabitIcon.Book,
    colorTheme = ColorTheme.Green,
    colorStops = listOf(ColorStop(0f, Rgba(1f, 2f, 3f, 1f))),
    dailyGoal = 2,
    weeklyGoal = 5,
    order = id,
    frozen = frozen,
    firstLogDay = firstLogDay,
    streakBeforeDay = streakBeforeDay,
    recent = recent,
)

fun todayResponse(day: LocalDate = DAY, vararg habits: TodayHabit) = TodayResponse(day, habits.toList())

fun dayLog(habitId: Int, day: LocalDate, rating: Int?) =
    DayLog(id = 1, habitId = habitId, rating = rating, notes = null, localDay = day, timeStamp = Instant.EPOCH, createdAt = Instant.EPOCH)

class FakeTokens(var token: String? = "t1") : SessionTokenSource {
    override fun currentToken() = token
    override fun onUnauthorized(rejectedToken: String) {}
}

class FakeScheduler : SyncScheduler {
    var flushes = 0
    var periodic = 0
    var cancelled = 0
    override fun flushOutbox() { flushes++ }
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
            is CheckRequest -> dayLog(body.habitId, body.day!!, body.rating)
            is IncrementRequest -> dayLog(body.habitId, body.day!!, body.delta)
            is EnsureDayLogRequest -> dayLog(body.habitId, body.day!!, null)
            else -> error("unexpected $body")
        }
    }
    val todayDays = mutableListOf<LocalDate?>()

    override suspend fun today(day: LocalDate?): TodayResponse {
        todayDays += day
        return todayAnswer()
    }

    override suspend fun check(body: CheckRequest, key: IdempotencyKey) = record(body, key)
    override suspend fun increment(body: IncrementRequest, key: IdempotencyKey) = record(body, key)
    override suspend fun ensureDayLog(body: EnsureDayLogRequest, key: IdempotencyKey) = record(body, key)

    private fun record(body: Any, key: IdempotencyKey): DayLog {
        sent += Sent(body, key.value)
        return respond(body)
    }
}
