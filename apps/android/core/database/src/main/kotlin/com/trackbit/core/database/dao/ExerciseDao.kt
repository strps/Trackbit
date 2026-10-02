package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import com.trackbit.core.database.entity.ExerciseEntity
import kotlinx.coroutines.flow.Flow

/** The cached exercise catalog. Only [SyncDao.applyExercises] writes it. */
@Dao
interface ExerciseDao {
    @Query("SELECT * FROM exercises ORDER BY name COLLATE NOCASE, id")
    fun observeAll(): Flow<List<ExerciseEntity>>

    @Query("SELECT * FROM exercises WHERE id = :id")
    suspend fun get(id: Int): ExerciseEntity?
}
