package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import com.trackbit.core.database.entity.ExerciseEntity
import kotlinx.coroutines.flow.Flow

/** The cached exercise catalog. Only [SyncDao.applyExercises] writes it. */
@Dao
interface ExerciseDao {
    @Query("SELECT * FROM exercises ORDER BY name COLLATE NOCASE, uuid")
    fun observeAll(): Flow<List<ExerciseEntity>>

    @Query("SELECT * FROM exercises WHERE uuid = :uuid")
    suspend fun get(uuid: String): ExerciseEntity?
}
