package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import com.trackbit.core.database.entity.HabitEntity
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

@Dao
interface HabitDao {
    @Query("SELECT * FROM habits ORDER BY `order`, id")
    fun observeAll(): Flow<List<HabitEntity>>

    @Query("SELECT * FROM habits WHERE id = :id")
    suspend fun get(id: Int): HabitEntity?

    /**
     * Records that [day] now has a log, so [HabitEntity.firstLogDay] is at most [day]. Call it
     * with every optimistic write: an anti-habit's streak is 0 until it has a first log day.
     */
    @Query("UPDATE habits SET firstLogDay = :day WHERE id = :id AND (firstLogDay IS NULL OR firstLogDay > :day)")
    suspend fun extendFirstLogDay(id: Int, day: LocalDate)
}
