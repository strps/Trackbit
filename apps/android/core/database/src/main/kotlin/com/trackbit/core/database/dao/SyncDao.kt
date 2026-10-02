package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.ExerciseEntity
import com.trackbit.core.database.entity.ExerciseLogEntity
import com.trackbit.core.database.entity.ExerciseSourceEntity
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.database.entity.PerformanceEntity
import com.trackbit.core.database.entity.QueueEntryEntity
import com.trackbit.core.database.entity.SessionEntity
import com.trackbit.core.database.entity.SourceQueueEntity
import com.trackbit.core.database.entity.toEntity
import com.trackbit.core.model.DayLog
import com.trackbit.core.model.DaysResponse
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseSessionDetail
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.ResolvedQueue
import com.trackbit.core.model.TodayResponse
import java.time.Instant
import java.time.LocalDate

/**
 * Writes server data into Room: `/today` snapshots, the rows tracker writes return, a day's
 * sessions, the exercise catalog and the picker's sources and queues. The only way server data reaches tracker tables, so the
 * pending-op guard lives in one place.
 */
@Dao
abstract class SyncDao {
    /**
     * Makes Room match a `/api/tracker/today` response: habits are replaced (deleted ones go,
     * with their logs), and each habit's `recent` days overwrite the local logs.
     *
     * A day log with ops still in the outbox keeps its optimistic value, and so does a pending
     * first log day, so a sync that lands before the outbox flushes never undoes a tap.
     */
    @Transaction
    open suspend fun applyToday(today: TodayResponse) {
        val pending = pendingDays().toSet()
        val pendingHabits = pending.mapTo(HashSet()) { it.habitId }
        val local = habits().associateBy { it.id }

        deleteHabitsNotIn(today.habits.map { it.id })
        upsertHabits(
            today.habits.map { habit ->
                val entity = habit.toEntity(today.day)
                val localFirst = local[habit.id]?.firstLogDay
                if (habit.id in pendingHabits) entity.copy(firstLogDay = earliest(entity.firstLogDay, localFirst)) else entity
            },
        )
        for (habit in today.habits) {
            for (day in habit.recent) {
                if (HabitDayKey(habit.id, day.day) in pending) continue
                if (day.rating == null && day.sessionCount == 0) {
                    deleteLog(habit.id, day.day)
                } else {
                    upsertLog(DayLogEntity(habit.id, day.day, day.rating, day.sessionCount))
                }
            }
        }
    }

    /**
     * Outbox op [opId] reached the server, which answered with [log]. Removes the op and stores
     * the server's row, unless more ops for that day log are still pending: their optimistic
     * change is newer, and the last of them brings the final row.
     */
    @Transaction
    open suspend fun applyConfirmed(opId: Long, log: DayLog) {
        deleteOp(opId)
        if (hasPending(log.habitId, log.localDay) || !habitExists(log.habitId)) return
        // The row carries no session count; attaching sessions doesn't go through the outbox.
        val sessionCount = log(log.habitId, log.localDay)?.sessionCount ?: 0
        upsertLog(DayLogEntity(log.habitId, log.localDay, log.rating, sessionCount))
        extendFirstLogDay(log.habitId, log.localDay)
    }

    /**
     * Makes Room's logs from [DaysResponse.start] to [DaysResponse.end] match a
     * `/api/tracker/days` response made at [syncedAt]. Days with pending ops keep their optimistic
     * value, and days of habits Room doesn't have are skipped: the next `/today` brings the habit.
     *
     * The pull is recorded on every request that starts within it (none is created), which is
     * right only if Room is fresh from [DaysResponse.end] on: a pull longer than `/days` allows
     * comes in chunks, newest first, and [DaysResponse.end] is the device's day.
     */
    @Transaction
    open suspend fun applyDays(days: DaysResponse, syncedAt: Instant) {
        val pending = pendingDays().toSet()
        val habitIds = habits().mapTo(HashSet()) { it.id }
        val server = days.days.associateBy { HabitDayKey(it.habitId, it.day) }
        for (local in logDaysBetween(days.start, days.end)) {
            if (local !in server && local !in pending) deleteLog(local.habitId, local.localDay)
        }
        for ((key, day) in server) {
            if (key in pending || day.habitId !in habitIds) continue
            if (day.rating == null && day.sessionCount == 0) {
                deleteLog(day.habitId, day.day)
            } else {
                upsertLog(DayLogEntity(day.habitId, day.day, day.rating, day.sessionCount))
            }
        }
        recordHistorySync(days.start, syncedAt)
    }

    /**
     * Makes Room's sessions of [habitId] on [day] (with their logs and sets) match a
     * `GET /api/tracker/exercise-sessions` response, and the day log's session count with them.
     * Skipped while ops for that day are pending: their optimistic rows are newer, and session ops
     * share the day log's key.
     */
    @Transaction
    open suspend fun applySessions(habitId: Int, day: LocalDate, sessions: List<ExerciseSessionDetail>) {
        if (hasPending(habitId, day) || !habitExists(habitId)) return
        // Children cascade. Rows keep their uuids, so a row on screen stays the same row.
        deleteSessions(habitId, day)
        for (session in sessions) {
            insertSession(SessionEntity(session.uuid, habitId, day, session.createdAt ?: Instant.EPOCH))
            for (log in session.exerciseLogs) {
                insertLog(
                    ExerciseLogEntity(
                        uuid = log.uuid,
                        sessionUuid = session.uuid,
                        exerciseId = log.exerciseId,
                        listItemId = log.listItemId,
                        createdAt = log.createdAt ?: Instant.EPOCH,
                        distance = log.distance,
                        duration = log.duration,
                        distanceUnit = log.distanceUnit,
                        weightUnit = log.weightUnit,
                    ),
                )
                for (set in log.exercisePerformances) {
                    insertSet(
                        PerformanceEntity(
                            uuid = set.uuid,
                            logUuid = log.uuid,
                            number = set.number,
                            reps = set.reps,
                            weight = set.weight,
                            duration = set.duration,
                            distance = set.distance,
                            rpe = set.rpe,
                            createdAt = set.createdAt ?: Instant.EPOCH,
                        ),
                    )
                }
            }
        }
        val log = log(habitId, day)
        if (log != null) {
            upsertLog(log.copy(sessionCount = sessions.size))
        } else if (sessions.isNotEmpty()) {
            // The server made the day's log when the first session started.
            upsertLog(DayLogEntity(habitId, day, rating = null, sessionCount = sessions.size))
            extendFirstLogDay(habitId, day)
        }
    }

    /** Replaces the exercise catalog. Nothing local is pending against it. */
    @Transaction
    open suspend fun applyExercises(exercises: List<Exercise>) {
        deleteExercisesNotIn(exercises.map { it.id })
        upsertExercises(exercises.map { it.toEntity() })
    }

    /** Replaces the exercise sources. A source no longer listed takes its cached queue with it. */
    @Transaction
    open suspend fun applySources(sources: List<ExerciseSourceDescriptor>) {
        deleteAllSources()
        insertSources(sources.mapIndexed { i, source -> source.toEntity(i) })
        deleteQueuesNotIn(sources.map { it.key })
    }

    /** Replaces [key]'s queue with the server's answer: [queue], or null when it no longer resolves. */
    @Transaction
    open suspend fun applyQueue(key: String, queue: ResolvedQueue?, pulledAt: Instant) {
        // Replacing the row cascades to its old entries.
        deleteQueue(key)
        insertQueue(SourceQueueEntity(key, gone = queue == null, emptyReason = queue?.emptyReason, pulledAt = pulledAt))
        if (queue != null) {
            insertEntries(
                queue.entries.mapIndexed { i, e -> QueueEntryEntity(key, i, e.exerciseId, e.position, e.listItemId, e.prescription) },
            )
        }
    }

    @Query("DELETE FROM exercise_sources")
    protected abstract suspend fun deleteAllSources()

    @Insert protected abstract suspend fun insertSources(sources: List<ExerciseSourceEntity>)

    @Query("DELETE FROM source_queues WHERE `key` NOT IN (:keys)")
    protected abstract suspend fun deleteQueuesNotIn(keys: List<String>)

    @Query("DELETE FROM source_queues WHERE `key` = :key")
    protected abstract suspend fun deleteQueue(key: String)

    @Insert protected abstract suspend fun insertQueue(queue: SourceQueueEntity)
    @Insert protected abstract suspend fun insertEntries(entries: List<QueueEntryEntity>)

    @Query("DELETE FROM exercise_sessions WHERE habitId = :habitId AND localDay = :day")
    protected abstract suspend fun deleteSessions(habitId: Int, day: LocalDate)

    @Insert protected abstract suspend fun insertSession(session: SessionEntity)
    @Insert protected abstract suspend fun insertLog(log: ExerciseLogEntity)
    @Insert protected abstract suspend fun insertSet(set: PerformanceEntity)

    @Query("DELETE FROM exercises WHERE id NOT IN (:ids)")
    protected abstract suspend fun deleteExercisesNotIn(ids: List<Int>)

    @Upsert
    protected abstract suspend fun upsertExercises(exercises: List<ExerciseEntity>)

    @Query("SELECT DISTINCT habitId, localDay FROM outbox")
    protected abstract suspend fun pendingDays(): List<HabitDayKey>

    @Query("SELECT habitId, localDay FROM day_logs WHERE localDay BETWEEN :start AND :end")
    protected abstract suspend fun logDaysBetween(start: LocalDate, end: LocalDate): List<HabitDayKey>

    @Query("UPDATE history SET syncedStart = :start, syncedAt = :at WHERE start >= :start")
    protected abstract suspend fun recordHistorySync(start: LocalDate, at: Instant)

    @Query("DELETE FROM outbox WHERE id = :id")
    protected abstract suspend fun deleteOp(id: Long)

    @Query("SELECT EXISTS(SELECT 1 FROM outbox WHERE habitId = :habitId AND localDay = :day)")
    protected abstract suspend fun hasPending(habitId: Int, day: LocalDate): Boolean

    @Query("SELECT EXISTS(SELECT 1 FROM habits WHERE id = :id)")
    protected abstract suspend fun habitExists(id: Int): Boolean

    @Query("SELECT * FROM day_logs WHERE habitId = :habitId AND localDay = :day")
    protected abstract suspend fun log(habitId: Int, day: LocalDate): DayLogEntity?

    @Query("UPDATE habits SET firstLogDay = :day WHERE id = :id AND (firstLogDay IS NULL OR firstLogDay > :day)")
    protected abstract suspend fun extendFirstLogDay(id: Int, day: LocalDate)

    @Query("SELECT * FROM habits")
    protected abstract suspend fun habits(): List<HabitEntity>

    @Query("DELETE FROM habits WHERE id NOT IN (:ids)")
    protected abstract suspend fun deleteHabitsNotIn(ids: List<Int>)

    @Upsert
    protected abstract suspend fun upsertHabits(habits: List<HabitEntity>)

    @Upsert
    protected abstract suspend fun upsertLog(log: DayLogEntity)

    @Query("DELETE FROM day_logs WHERE habitId = :habitId AND localDay = :day")
    protected abstract suspend fun deleteLog(habitId: Int, day: LocalDate)

    private fun earliest(a: LocalDate?, b: LocalDate?): LocalDate? = listOfNotNull(a, b).minOrNull()
}
