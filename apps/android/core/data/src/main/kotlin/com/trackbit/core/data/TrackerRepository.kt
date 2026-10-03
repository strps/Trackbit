package com.trackbit.core.data

import androidx.room.withTransaction
import com.trackbit.core.data.sync.SyncScheduler
import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.data.sync.checkOp
import com.trackbit.core.data.sync.ensureDayLogOp
import com.trackbit.core.data.sync.incrementOp
import com.trackbit.core.data.sync.isDue
import com.trackbit.core.database.dao.HabitDay
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.database.entity.HistoryEntity
import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.database.entity.TimerEntity
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.HistoryOwner
import com.trackbit.core.model.Streak
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import javax.inject.Inject

/**
 * Tracking for the app and widgets. Reads come from Room only. Writes change Room at once and
 * queue an outbox op in the same transaction; the server hears about it when it can.
 *
 * `day` is always the local day the user is looking at, and it is what the server is sent.
 */
interface TrackerRepository {
    /**
     * Every habit on [day], in display order, each with the [days] days ending at [day]. Days more
     * than a week back are empty unless [requestHistory] covers them; a past day's streak needs
     * that history and a window of [STREAK_DAYS].
     */
    fun observeDay(day: LocalDate, days: Int = RECENT_DAYS): Flow<List<TrackedHabit>>

    /**
     * One habit on [day], or null once it no longer exists. [TrackedHabit.recent] holds the [days]
     * days ending at [day]; days more than a week back are empty unless [requestHistory] covers them.
     */
    fun observeHabit(habitId: Int, day: LocalDate, days: Int = RECENT_DAYS): Flow<TrackedHabit?>

    /**
     * Keeps every habit's logs from [start] on in Room for [owner], pulling them from the server
     * now and then, instead of only the last week. Call it whenever the shown range may have
     * changed; it pulls only when the kept range doesn't cover [start] or has gone stale. A later
     * call from the same owner replaces its [start].
     */
    suspend fun requestHistory(owner: HistoryOwner, start: LocalDate)

    /** [owner] stops keeping history: logs no other request covers, before the last week, are dropped. */
    suspend fun releaseHistory(owner: HistoryOwner)

    /** Habits with a running timer, oldest timer first, each on the day its timer logs to. */
    fun observeRunningTimers(): Flow<List<TrackedHabit>>

    /** Writes not yet confirmed by the server, for a "not synced" indicator. */
    val pendingWrites: Flow<Int>

    /**
     * Emits after anything [observeDay] or [observeHabit] reads may have changed, for any day: a
     * write, a sync, or sign-out clearing it all. For widgets, which can't keep collecting.
     */
    val changes: Flow<Unit>

    /** Sets the day's value: a count, 0/1 for check habits, milliseconds for timed ones. */
    suspend fun setRating(habitId: Int, day: LocalDate, rating: Int): WriteResult

    /** Adds [delta] (not 0) to the day's value. Concurrent increments from other devices add up. */
    suspend fun increment(habitId: Int, day: LocalDate, delta: Int): WriteResult

    /** Check habits: done ↔ not done. */
    suspend fun toggle(habitId: Int, day: LocalDate): WriteResult

    /** Makes sure the day has a log, e.g. before attaching an exercise session. */
    suspend fun ensureDayLog(habitId: Int, day: LocalDate): WriteResult

    /**
     * Timed habits: starts a timer that logs to [day] when it stops. Nothing reaches the server
     * until then. [WriteResult.Queued] means it runs; [WriteResult.NoChange] that one already ran,
     * or that the habit isn't timed.
     */
    suspend fun startTimer(habitId: Int, day: LocalDate): WriteResult

    /**
     * Stops the habit's timer and adds its time to the timer's day, in one transaction, so a
     * second stop (the notification and a widget at once) finds nothing to log. The time is
     * dropped if the habit has been frozen since. [WriteResult.NoChange]: no timer was running.
     */
    suspend fun stopTimer(habitId: Int): WriteResult

    /** Adds [ms] (> 0) to the habit's running timer. [WriteResult.NoChange]: none was running. */
    suspend fun addToTimer(habitId: Int, ms: Long): WriteResult

    /** Sends pending writes, then reloads today from the server. For pull-to-refresh. */
    suspend fun refresh(): SyncResult
}

/** What [TrackerRepository.observeHabit] returns by default: the week `/today` brings. */
const val RECENT_DAYS = HabitDay.RECENT_DAYS

/** A window long enough to walk back any streak (they are capped at [Streak.MAX_DAYS]). */
const val STREAK_DAYS = Streak.MAX_DAYS + 1

enum class WriteResult {
    /** Applied locally and queued for the server. */
    Queued,

    /** Nothing changed: the habit is over the user's role limits and read-only. */
    HabitFrozen,

    /** Nothing changed: the habit isn't in Room (deleted, or not synced yet). */
    HabitNotFound,

    /** Nothing changed: the custom exercise is over the user's role limits and read-only. */
    ExerciseFrozen,

    /** Nothing changed: it was already done, e.g. a timer stopped twice. */
    NoChange,
}

/** Ordered from best to worst. */
enum class SyncResult {
    Done,

    /** Offline or a server error; background sync tries again. */
    Retry,

    /** The server refused the request; retrying won't help. */
    Failed,

    /** No session, or it ended while syncing. */
    SignedOut,
}

@OptIn(ExperimentalCoroutinesApi::class)
internal class DefaultTrackerRepository @Inject constructor(
    private val db: TrackbitDatabase,
    private val sync: TrackerSync,
    private val scheduler: SyncScheduler,
    private val clock: Clock,
) : TrackerRepository {
    private val habitDao = db.habitDao()
    private val dayLogDao = db.dayLogDao()
    private val habitDayDao = db.habitDayDao()
    private val outboxDao = db.outboxDao()
    private val writer = OutboxWriter(db, scheduler)
    private val timerDao = db.timerDao()
    private val historyDao = db.historyDao()

    override fun observeDay(day: LocalDate, days: Int): Flow<List<TrackedHabit>> =
        habitDayDao.observeDay(day, days).map { days -> days.map { it.toTrackedHabit() } }

    override fun observeHabit(habitId: Int, day: LocalDate, days: Int): Flow<TrackedHabit?> =
        habitDayDao.observeHabitDay(habitId, day, days).map { it?.toTrackedHabit() }

    override suspend fun requestHistory(owner: HistoryOwner, start: LocalDate) {
        val due = db.withTransaction {
            val now = clock.instant()
            val requests = historyDao.all()
            var history = (requests.find { it.owner == owner } ?: HistoryEntity(owner, start)).copy(start = start)
            // Another owner's pull may already cover the range.
            val covering = requests
                .filter { it.owner != owner && it.syncedStart?.isAfter(start) == false }
                .maxByOrNull { it.syncedAt ?: Instant.MIN }
            if (covering != null && history.isDue(now) && !covering.copy(start = start).isDue(now)) {
                history = history.copy(syncedStart = covering.syncedStart, syncedAt = covering.syncedAt)
            }
            historyDao.upsert(history)
            history.isDue(now)
        }
        if (due) scheduler.syncHistory()
    }

    override suspend fun releaseHistory(owner: HistoryOwner) =
        historyDao.release(owner, recentFrom = LocalDate.now().minusDays(RECENT_DAYS - 1L))

    override fun observeRunningTimers(): Flow<List<TrackedHabit>> = timerDao.observeHabitTimers().flatMapLatest { timers ->
        val habitTimers = timers.mapNotNull { timer -> timer.habitId?.let { id -> timer.localDay?.let { id to it } } }
        if (habitTimers.isEmpty()) {
            flowOf(emptyList())
        } else {
            combine(habitTimers.map { (id, day) -> observeHabit(id, day) }) { habits -> habits.filterNotNull() }
        }
    }

    override val pendingWrites: Flow<Int> get() = outboxDao.observeCount()

    override val changes: Flow<Unit>
        get() = db.invalidationTracker.createFlow(HabitEntity.TABLE, DayLogEntity.TABLE, TimerEntity.TABLE, emitInitialState = false)
            .map { }

    override suspend fun setRating(habitId: Int, day: LocalDate, rating: Int) = writer.write(habitId) {
        dayLogDao.setRating(habitId, day, rating)
        checkOp(habitId, day, rating)
    }

    override suspend fun increment(habitId: Int, day: LocalDate, delta: Int): WriteResult {
        require(delta != 0) { "delta must not be 0" }
        return writer.write(habitId) {
            dayLogDao.addToRating(habitId, day, delta)
            incrementOp(habitId, day, delta)
        }
    }

    // Sent as an absolute value, so a replayed or reordered toggle can't flip it back.
    override suspend fun toggle(habitId: Int, day: LocalDate) = writer.write(habitId) {
        val rating = if ((dayLogDao.get(habitId, day)?.rating ?: 0) > 0) 0 else 1
        dayLogDao.setRating(habitId, day, rating)
        checkOp(habitId, day, rating)
    }

    override suspend fun ensureDayLog(habitId: Int, day: LocalDate) = writer.write(habitId) {
        dayLogDao.ensure(habitId, day)
        ensureDayLogOp(habitId, day)
    }

    override suspend fun startTimer(habitId: Int, day: LocalDate): WriteResult = db.withTransaction {
        val habit = habitDao.get(habitId) ?: return@withTransaction WriteResult.HabitNotFound
        when {
            habit.frozen -> WriteResult.HabitFrozen
            habit.type != HabitType.Timed -> WriteResult.NoChange
            timerDao.start(TimerEntity(habitId = habitId, localDay = day, startedAt = clock.instant())) == -1L ->
                WriteResult.NoChange
            else -> WriteResult.Queued
        }
    }

    override suspend fun stopTimer(habitId: Int): WriteResult = writer.flushIfQueued(
        db.withTransaction {
            val timer = timerDao.forHabit(habitId) ?: return@withTransaction WriteResult.NoChange
            timerDao.delete(timer.id)
            val habitTimer = timer.toHabitTimer() ?: return@withTransaction WriteResult.NoChange
            // Timed values are milliseconds in an Int column.
            val elapsed = habitTimer.elapsedMs(clock.instant()).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
            if (elapsed == 0) return@withTransaction WriteResult.NoChange
            writer.queue(habitId) {
                dayLogDao.addToRating(habitId, habitTimer.day, elapsed)
                incrementOp(habitId, habitTimer.day, elapsed)
            }
        },
    )

    override suspend fun addToTimer(habitId: Int, ms: Long): WriteResult {
        require(ms > 0) { "ms must be positive" }
        return db.withTransaction {
            val timer = timerDao.forHabit(habitId) ?: return@withTransaction WriteResult.NoChange
            // Counting up: an earlier start is more time.
            timerDao.setStartedAt(timer.id, timer.startedAt.minusMillis(ms))
            WriteResult.Queued
        }
    }

    override suspend fun refresh(): SyncResult = sync.sync()
}
