package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.database.entity.toEntity
import com.trackbit.core.model.DayLog
import com.trackbit.core.model.TodayResponse
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
                if (PendingDay(habit.id, day.day) in pending) continue
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

    @Query("SELECT DISTINCT habitId, localDay FROM outbox")
    protected abstract suspend fun pendingDays(): List<PendingDay>

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
