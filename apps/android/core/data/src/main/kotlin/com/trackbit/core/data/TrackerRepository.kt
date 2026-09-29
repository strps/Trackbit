package com.trackbit.core.data

import androidx.room.withTransaction
import com.trackbit.core.data.sync.SyncScheduler
import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.data.sync.checkOp
import com.trackbit.core.data.sync.ensureDayLogOp
import com.trackbit.core.data.sync.incrementOp
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.database.entity.OutboxEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
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

    /** One habit on [day], or null once it no longer exists. */
    fun observeHabit(habitId: Int, day: LocalDate): Flow<TrackedHabit?>

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

    /** Sends pending writes, then reloads today from the server. For pull-to-refresh. */
    suspend fun refresh(): SyncResult
}

enum class WriteResult {
    /** Applied locally and queued for the server. */
    Queued,

    /** Nothing changed: the habit is over the user's role limits and read-only. */
    HabitFrozen,

    /** Nothing changed: the habit isn't in Room (deleted, or not synced yet). */
    HabitNotFound,
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

internal class DefaultTrackerRepository @Inject constructor(
    private val db: TrackbitDatabase,
    private val sync: TrackerSync,
    private val scheduler: SyncScheduler,
) : TrackerRepository {
    private val habitDao = db.habitDao()
    private val dayLogDao = db.dayLogDao()
    private val habitDayDao = db.habitDayDao()
    private val outboxDao = db.outboxDao()

    override fun observeDay(day: LocalDate): Flow<List<TrackedHabit>> =
        habitDayDao.observeDay(day).map { days -> days.map { it.toTrackedHabit() } }

    override fun observeHabit(habitId: Int, day: LocalDate): Flow<TrackedHabit?> =
        habitDayDao.observeHabitDay(habitId, day).map { it?.toTrackedHabit() }

    override val pendingWrites: Flow<Int> get() = outboxDao.observeCount()

    override val changes: Flow<Unit>
        get() = db.invalidationTracker.createFlow(HabitEntity.TABLE, DayLogEntity.TABLE, emitInitialState = false)
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

    override suspend fun refresh(): SyncResult = sync.sync()

    /** Applies [change] and queues the op it returns, in one transaction, then starts a flush. */
    private suspend fun write(habitId: Int, change: suspend () -> OutboxEntity): WriteResult {
        val result = db.withTransaction {
            val habit = habitDao.get(habitId) ?: return@withTransaction WriteResult.HabitNotFound
            if (habit.frozen) return@withTransaction WriteResult.HabitFrozen
            val op = change()
            // The server's first log day is its earliest row; an anti-habit streak starts there.
            habitDao.extendFirstLogDay(habitId, op.localDay)
            outboxDao.enqueue(op)
            WriteResult.Queued
        }
        if (result == WriteResult.Queued) scheduler.flushOutbox()
        return result
    }
}
