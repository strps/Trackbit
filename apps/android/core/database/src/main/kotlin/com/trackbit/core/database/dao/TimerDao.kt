package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import com.trackbit.core.database.entity.TimerEntity
import kotlinx.coroutines.flow.Flow
import java.time.Instant

@Dao
interface TimerDao {
    /** Returns the new row's id, or -1 when the habit already has a timer (it keeps running). */
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun start(timer: TimerEntity): Long

    @Query("SELECT * FROM timers WHERE habitId = :habitId")
    suspend fun forHabit(habitId: Int): TimerEntity?

    @Query("DELETE FROM timers WHERE id = :id")
    suspend fun delete(id: Long)

    @Query("UPDATE timers SET startedAt = :startedAt WHERE id = :id")
    suspend fun setStartedAt(id: Long, startedAt: Instant)

    /** Every running habit timer, oldest first. */
    @Query("SELECT * FROM timers WHERE habitId IS NOT NULL ORDER BY startedAt, id")
    fun observeHabitTimers(): Flow<List<TimerEntity>>

    @Query("SELECT * FROM timers WHERE endsAt IS NOT NULL LIMIT 1")
    suspend fun rest(): TimerEntity?

    @Query("SELECT * FROM timers WHERE endsAt IS NOT NULL LIMIT 1")
    fun observeRest(): Flow<TimerEntity?>

    @Query("DELETE FROM timers WHERE endsAt IS NOT NULL")
    suspend fun deleteRest()

    @Query("UPDATE timers SET endsAt = :endsAt WHERE id = :id")
    suspend fun setEndsAt(id: Long, endsAt: Instant)

    /** Starts the rest timer, replacing the one running: there is at most one. */
    @Transaction
    suspend fun replaceRest(startedAt: Instant, endsAt: Instant): Long {
        deleteRest()
        return start(TimerEntity(habitId = null, localDay = null, startedAt = startedAt, endsAt = endsAt))
    }
}
