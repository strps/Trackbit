package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import com.trackbit.core.database.entity.HabitSetEntity
import com.trackbit.core.database.entity.HabitSetPullEntity
import kotlinx.coroutines.flow.Flow

/** Reads of the cached sets. Only [SyncDao.applySets] writes them. */
@Dao
interface HabitSetDao {
    @Query("SELECT * FROM habit_sets WHERE habitId = :habitId ORDER BY ordinal")
    fun observeSets(habitId: Int): Flow<List<HabitSetEntity>>

    @Query("SELECT * FROM habit_set_pulls WHERE habitId = :habitId")
    fun observePull(habitId: Int): Flow<HabitSetPullEntity?>
}
