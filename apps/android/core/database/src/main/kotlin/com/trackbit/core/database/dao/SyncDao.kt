package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.database.entity.toEntity
import com.trackbit.core.model.DayLog
import com.trackbit.core.model.DaysResponse
import com.trackbit.core.model.TodayResponse
import java.time.Instant
import java.time.LocalDate

/**
 * Writes server data into Room: `/today` snapshots and the rows tracker writes return. The only
 * way server data reaches tracker tables, so the pending-op guard lives in one place.
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
     * `/api/tracker/days` response, and records the pull on the history request made at
     * [syncedAt] (if it still exists). Days with pending ops keep their optimistic value, and
     * days of habits Room doesn't have are skipped: the next `/today` brings the habit.
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

    @Query("SELECT DISTINCT habitId, localDay FROM outbox")
    protected abstract suspend fun pendingDays(): List<HabitDayKey>

    @Query("SELECT habitId, localDay FROM day_logs WHERE localDay BETWEEN :start AND :end")
    protected abstract suspend fun logDaysBetween(start: LocalDate, end: LocalDate): List<HabitDayKey>

    @Query("UPDATE history SET syncedStart = :start, syncedAt = :at")
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
