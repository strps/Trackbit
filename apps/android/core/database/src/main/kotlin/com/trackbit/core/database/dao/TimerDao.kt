package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
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

    /** Every running timer, oldest first. */
    @Query("SELECT * FROM timers ORDER BY startedAt, id")
    fun observeAll(): Flow<List<TimerEntity>>
}
