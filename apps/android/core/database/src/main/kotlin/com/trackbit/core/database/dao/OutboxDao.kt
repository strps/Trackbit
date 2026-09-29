package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.trackbit.core.database.entity.OutboxEntity
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

/** Identifies a day log: one habit on one day. */
data class HabitDayKey(val habitId: Int, val localDay: LocalDate)

@Dao
interface OutboxDao {
    /** Returns the op's id. Insert it in the same transaction as its optimistic change. */
    @Insert
    suspend fun enqueue(op: OutboxEntity): Long

    /** The next op to send; ops go out in the order they were queued. */
    @Query("SELECT * FROM outbox ORDER BY id LIMIT 1")
    suspend fun oldest(): OutboxEntity?

    @Query("DELETE FROM outbox WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("UPDATE outbox SET attempts = attempts + 1 WHERE id = :id")
    suspend fun recordFailure(id: Long)

    @Query("SELECT EXISTS(SELECT 1 FROM outbox WHERE habitId = :habitId AND localDay = :day)")
    suspend fun hasPending(habitId: Int, day: LocalDate): Boolean

    @Query("SELECT DISTINCT habitId, localDay FROM outbox")
    suspend fun pendingDays(): List<HabitDayKey>

    /** For a "not synced yet" indicator. */
    @Query("SELECT COUNT(*) FROM outbox")
    fun observeCount(): Flow<Int>
}
