package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Transaction
import com.trackbit.core.database.entity.ConfigPart
import com.trackbit.core.database.entity.LimitsEntity
import com.trackbit.core.database.entity.ListWithItems
import com.trackbit.core.database.entity.MuscleGroupEntity
import kotlinx.coroutines.flow.Flow

/**
 * What the config screens read: lists, muscle groups, limits and which parts Room holds (habits
 * and exercises have their own DAOs). Only [SyncDao] writes them.
 */
@Dao
interface ConfigDao {
    /** Whether [part] has been pulled since Room was last cleared. */
    @Query("SELECT EXISTS(SELECT 1 FROM config_pulls WHERE part = :part)")
    fun observePulled(part: ConfigPart): Flow<Boolean>

    @Transaction
    @Query("SELECT * FROM exercise_lists ORDER BY position, uuid")
    fun observeLists(): Flow<List<ListWithItems>>

    @Query("SELECT * FROM muscle_groups")
    fun observeMuscleGroups(): Flow<List<MuscleGroupEntity>>

    @Query("SELECT * FROM limits WHERE id = ${LimitsEntity.ID}")
    fun observeLimits(): Flow<LimitsEntity?>
}
