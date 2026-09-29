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
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import java.time.Clock
import java.time.LocalDate
import javax.inject.Inject

/**
 * Tracking for the app and widgets. Reads come from Room only. Writes change Room at once and
 * queue an outbox op in the same transaction; the server hears about it when it can.
 *
 * `day` is always the local day the user is looking at, and it is what the server is sent.
 */
interface TrackerRepository {
    /** Every habit on [day], in display order. */
    fun observeDay(day: LocalDate): Flow<List<TrackedHabit>>

    /**
     * One habit on [day], or null once it no longer exists. [TrackedHabit.recent] holds the [days]
     * days ending at [day]; days more than a week back are empty unless [requestHistory] covers them.
     */
    fun observeHabit(habitId: Int, day: LocalDate, days: Int = RECENT_DAYS): Flow<TrackedHabit?>

    /**
     * Keeps every habit's logs from [start] on (at most a year back) in Room, pulling them from
     * the server now and then, instead of only the last week. For heatmaps: call it whenever the
     * shown range may have changed; it pulls only when the kept range doesn't cover [start] or has
     * gone stale. A later call replaces [start].
     */
    suspend fun requestHistory(start: LocalDate)

    /** Stops keeping history: logs from before the last week are dropped. */
    suspend fun releaseHistory()

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

enum class WriteResult {
    /** Applied locally and queued for the server. */
    Queued,

    /** Nothing changed: the habit is over the user's role limits and read-only. */
    HabitFrozen,

    /** Nothing changed: the habit isn't in Room (deleted, or not synced yet). */
    HabitNotFound,

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
    private val timerDao = db.timerDao()
    private val historyDao = db.historyDao()

    override fun observeDay(day: LocalDate): Flow<List<TrackedHabit>> =
        habitDayDao.observeDay(day).map { days -> days.map { it.toTrackedHabit() } }

    override fun observeHabit(habitId: Int, day: LocalDate, days: Int): Flow<TrackedHabit?> =
        habitDayDao.observeHabitDay(habitId, day, days).map { it?.toTrackedHabit() }

    override suspend fun requestHistory(start: LocalDate) {
        val due = db.withTransaction {
            val history = (historyDao.get() ?: HistoryEntity(start = start)).copy(start = start)
            historyDao.upsert(history)
            history.isDue(clock.instant())
        }
        if (due) scheduler.syncHistory()
    }

    override suspend fun releaseHistory() = historyDao.release(keepFrom = LocalDate.now().minusDays(RECENT_DAYS - 1L))

    override fun observeRunningTimers(): Flow<List<TrackedHabit>> = timerDao.observeAll().flatMapLatest { timers ->
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

    override suspend fun setRating(habitId: Int, day: LocalDate, rating: Int) = write(habitId) {
        dayLogDao.setRating(habitId, day, rating)
        checkOp(habitId, day, rating)
    }

    override suspend fun increment(habitId: Int, day: LocalDate, delta: Int): WriteResult {
        require(delta != 0) { "delta must not be 0" }
        return write(habitId) {
            dayLogDao.addToRating(habitId, day, delta)
            incrementOp(habitId, day, delta)
        }
    }

    // Sent as an absolute value, so a replayed or reordered toggle can't flip it back.
    override suspend fun toggle(habitId: Int, day: LocalDate) = write(habitId) {
        val rating = if ((dayLogDao.get(habitId, day)?.rating ?: 0) > 0) 0 else 1
        dayLogDao.setRating(habitId, day, rating)
        checkOp(habitId, day, rating)
    }

    override suspend fun ensureDayLog(habitId: Int, day: LocalDate) = write(habitId) {
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

    override suspend fun stopTimer(habitId: Int): WriteResult = flushIfQueued(
        db.withTransaction {
            val timer = timerDao.forHabit(habitId) ?: return@withTransaction WriteResult.NoChange
            timerDao.delete(timer.id)
            val habitTimer = timer.toHabitTimer() ?: return@withTransaction WriteResult.NoChange
            // Timed values are milliseconds in an Int column.
            val elapsed = habitTimer.elapsedMs(clock.instant()).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
            if (elapsed == 0) return@withTransaction WriteResult.NoChange
            queue(habitId) {
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

    /** Applies [change] and queues the op it returns, in one transaction, then starts a flush. */
    private suspend fun write(habitId: Int, change: suspend () -> OutboxEntity): WriteResult =
        flushIfQueued(db.withTransaction { queue(habitId, change) })

    /** Inside a transaction: applies [change] and queues its op, unless the habit is frozen or gone. */
    private suspend fun queue(habitId: Int, change: suspend () -> OutboxEntity): WriteResult {
        val habit = habitDao.get(habitId) ?: return WriteResult.HabitNotFound
        if (habit.frozen) return WriteResult.HabitFrozen
        val op = change()
        // The server's first log day is its earliest row; an anti-habit streak starts there.
        habitDao.extendFirstLogDay(habitId, op.localDay)
        outboxDao.enqueue(op)
        return WriteResult.Queued
    }

    private fun flushIfQueued(result: WriteResult): WriteResult {
        if (result == WriteResult.Queued) scheduler.flushOutbox()
        return result
    }
}
