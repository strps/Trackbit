package com.trackbit.core.data

import com.trackbit.core.data.di.DataScope
import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.database.entity.ConfigPart
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseRequest
import com.trackbit.core.model.MuscleGroup
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.service.ExerciseService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The exercise library. It reads Room's catalog, the one the picker, sessions and analytics read,
 * which [refresh] and the background sync fill, so it works offline. Writes still need a
 * connection (F5 moves them to the outbox): each goes to the server and its answer into Room.
 */
interface ExerciseLibraryRepository {
    /** System exercises plus the user's own, with descriptions, muscle groups and `frozen`; null until pulled. */
    fun exercises(): Flow<List<Exercise>?>

    /** The shared muscle group taxonomy; null until pulled. */
    fun muscleGroups(): Flow<List<MuscleGroup>?>

    /** The role's caps; null when nothing is capped, or until they're pulled. */
    fun limits(): Flow<EffectiveLimits?>

    /** Pulls the catalog, the muscle groups and the limits into Room. */
    suspend fun refresh(): SyncResult

    /** [request] names the new exercise by its uuid, picked once per form so a retry can't create it twice. */
    suspend fun create(request: ExerciseRequest): ConfigResult<Exercise>

    /** One of the user's own exercises; a frozen one fails with [ConfigError.CustomExerciseFrozen]. */
    suspend fun update(uuid: String, request: ExerciseRequest): ConfigResult<Exercise>

    /**
     * Deletes one of the user's own exercises (frozen too) with every log of it and its list
     * items. One already gone counts as deleted.
     */
    suspend fun delete(uuid: String): ConfigResult<Unit>
}

internal class DefaultExerciseLibraryRepository @Inject constructor(
    private val db: TrackbitDatabase,
    private val exerciseService: ExerciseService,
    private val sync: TrackerSync,
    @DataScope private val scope: CoroutineScope,
) : ExerciseLibraryRepository {
    private val config = db.configDao()

    override fun exercises(): Flow<List<Exercise>?> =
        combine(config.observePulled(ConfigPart.Exercises), db.exerciseDao().observeAll()) { pulled, rows ->
            if (pulled) rows.map { it.toExercise() } else null
        }

    override fun muscleGroups(): Flow<List<MuscleGroup>?> =
        combine(config.observePulled(ConfigPart.MuscleGroups), config.observeMuscleGroups()) { pulled, rows ->
            if (pulled) rows.map { it.toMuscleGroup() } else null
        }

    override fun limits(): Flow<EffectiveLimits?> = config.observeLimits().map { it?.effective }

    override suspend fun refresh() = sync.syncConfig(ConfigPart.Exercises, ConfigPart.MuscleGroups, ConfigPart.Limits)

    override suspend fun create(request: ExerciseRequest): ConfigResult<Exercise> {
        requireNotNull(request.uuid) { "A create names its exercise" }
        return sync.write({ exerciseService.createExercise(request) }) { storeExercise(it) }.toConfigResult()
    }

    override suspend fun update(uuid: String, request: ExerciseRequest) =
        sync.write({ exerciseService.updateExercise(uuid, request.copy(uuid = null)) }) { storeExercise(it) }.toConfigResult()

    override suspend fun delete(uuid: String): ConfigResult<Unit> {
        val result = sync.delete({ exerciseService.deleteExercise(uuid) }) { removeExercise(uuid) }
        if (result is ApiResult.Success) {
            // Another exercise may have thawed, and the sources' item counts changed.
            scope.launch {
                sync.syncConfig(ConfigPart.Exercises)
                sync.syncSources()
            }
        }
        return result.toConfigResult()
    }
}
