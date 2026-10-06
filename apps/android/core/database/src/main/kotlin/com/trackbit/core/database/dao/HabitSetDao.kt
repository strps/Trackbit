package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import com.trackbit.core.database.entity.HabitSetEntity
import com.trackbit.core.database.entity.HabitSetPullEntity
import kotlinx.coroutines.flow.Flow

/** Reads of the cached sets. Only [SyncDao.applySets] writes them. */
@Dao
interface HabitSetDao {
    @Query("SELECT * FROM habit_sets WHERE habitUuid = :habitUuid ORDER BY ordinal")
    fun observeSets(habitUuid: String): Flow<List<HabitSetEntity>>

    @Query("SELECT * FROM habit_set_pulls WHERE habitUuid = :habitUuid")
    fun observePull(habitUuid: String): Flow<HabitSetPullEntity?>
}
