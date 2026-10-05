package com.trackbit.core.data

import com.trackbit.core.data.di.DataScope
import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseRequest
import com.trackbit.core.model.LimitsResponse
import com.trackbit.core.model.MuscleGroup
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.safeCall
import com.trackbit.core.network.service.ExerciseService
import com.trackbit.core.network.service.MeService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The exercise library. Like the habits config it needs a connection: reads and writes go to
 * the server (Room's catalog keeps neither descriptions nor `frozen` as the library shows
 * them), and after a write succeeds Room's catalog (the picker, sessions, analytics) catches up
 * in the background, so a closed screen doesn't cancel it.
 */
interface ExerciseLibraryRepository {
    /** System exercises plus the user's own, with descriptions, muscle groups and `frozen`. */
    suspend fun exercises(): ConfigResult<List<Exercise>>

    /** The shared muscle group taxonomy. */
    suspend fun muscleGroups(): ConfigResult<List<MuscleGroup>>

    /** The role's caps and the user's counts. */
    suspend fun limits(): ConfigResult<LimitsResponse>

    suspend fun create(request: ExerciseRequest): ConfigResult<Exercise>

    /** One of the user's own exercises; a frozen one fails with [ConfigError.CustomExerciseFrozen]. */
    suspend fun update(id: Int, request: ExerciseRequest): ConfigResult<Exercise>

    /** Deletes one of the user's own exercises (frozen too) with every log of it and its list items. */
    suspend fun delete(id: Int): ConfigResult<Unit>
}

internal class DefaultExerciseLibraryRepository @Inject constructor(
    private val exerciseService: ExerciseService,
    private val meService: MeService,
    private val sync: TrackerSync,
    @DataScope private val scope: CoroutineScope,
) : ExerciseLibraryRepository {
    override suspend fun exercises() = safeCall { exerciseService.exercises() }.toConfigResult()

    override suspend fun muscleGroups() = safeCall { exerciseService.muscleGroups() }.toConfigResult()

    override suspend fun limits() = safeCall { meService.limits() }.toConfigResult()

    override suspend fun create(request: ExerciseRequest) =
        write({ exerciseService.createExercise(request) }) { sync.syncExercises() }

    override suspend fun update(id: Int, request: ExerciseRequest) =
        write({ exerciseService.updateExercise(id, request) }) { sync.syncExercises() }

    override suspend fun delete(id: Int) = write({ exerciseService.deleteExercise(id) }) { sync.removeExercise(id) }

    private suspend fun <T> write(call: suspend () -> T, then: suspend () -> Unit): ConfigResult<T> {
        val result = safeCall(call)
        if (result is ApiResult.Success) scope.launch { then() }
        return result.toConfigResult()
    }
}
