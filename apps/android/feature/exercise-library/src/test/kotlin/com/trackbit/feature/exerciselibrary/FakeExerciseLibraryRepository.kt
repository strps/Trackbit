package com.trackbit.feature.exerciselibrary

import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.ExerciseLibraryRepository
import com.trackbit.core.data.SyncResult
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseRequest
import com.trackbit.core.model.LastPerformance
import com.trackbit.core.model.MuscleGroup
import com.trackbit.core.model.MuscleGroupRef
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.yield

/**
 * A server holding [exercises], [muscleGroups] and [limits], and Room's copy, which [refresh]
 * fills and successful writes update as the real repository stores their answers. A non-null
 * [failWith] fails the next calls (a refresh with [ConfigError.Offline] as offline). Suspends,
 * like the network.
 */
class FakeExerciseLibraryRepository : ExerciseLibraryRepository {
    var exercises = listOf<Exercise>()
    var muscleGroups = listOf<MuscleGroup>()
    var limits: EffectiveLimits? = null
    var failWith: ConfigError? = null
    val created = mutableListOf<ExerciseRequest>()
    val updated = mutableListOf<Pair<String, ExerciseRequest>>()
    val deleted = mutableListOf<String>()
    var refreshes = 0

    private val room = MutableStateFlow<List<Exercise>?>(null)
    private val roomGroups = MutableStateFlow<List<MuscleGroup>?>(null)
    private val roomLimits = MutableStateFlow<EffectiveLimits?>(null)

    override fun exercises(): Flow<List<Exercise>?> = room

    override fun muscleGroups(): Flow<List<MuscleGroup>?> = roomGroups

    override fun limits(): Flow<EffectiveLimits?> = roomLimits

    override suspend fun refresh(): SyncResult {
        yield()
        refreshes++
        return when (failWith) {
            null -> {
                room.value = exercises
                roomGroups.value = muscleGroups
                roomLimits.value = limits
                SyncResult.Done
            }
            ConfigError.Offline -> SyncResult.Retry
            else -> SyncResult.Failed
        }
    }

    private suspend fun <T> answer(value: () -> T): ConfigResult<T> {
        yield()
        val failure = failWith ?: return ConfigResult.Success(value()).also { room.value = room.value?.let { exercises } }
        return ConfigResult.Failure(failure)
    }

    /** Every create sent, refused ones included. */
    override suspend fun create(request: ExerciseRequest): ConfigResult<Exercise> {
        created += request
        return answer { exercise(100, request.name, mine = true).copy(uuid = request.uuid!!).also { exercises = exercises + it } }
    }

    override suspend fun update(uuid: String, request: ExerciseRequest) = answer {
        updated += uuid to request
        exercise(100, request.name, mine = true).copy(uuid = uuid).also { new -> exercises = exercises.map { if (it.uuid == uuid) new else it } }
    }

    override suspend fun delete(uuid: String) = answer {
        deleted += uuid
        exercises = exercises.filterNot { it.uuid == uuid }
    }
}

fun exercise(
    n: Int,
    name: String = "Exercise $n",
    mine: Boolean = false,
    frozen: Boolean = false,
    category: String = "strength",
    description: String? = null,
    muscles: List<MuscleGroupRef> = emptyList(),
    logged: Boolean = false,
) = Exercise(
    uuid = exerciseUuid(n),
    userId = if (mine) "user" else null,
    name = name,
    description = description,
    category = category,
    defaultWeightUnit = "kg",
    defaultDistanceUnit = "km",
    lastPerformance = if (logged) LastPerformance(1, 20.0, 5, null, null, null, null) else null,
    muscleGroups = muscles,
    frozen = frozen,
)

fun group(id: Int, name: String, parentId: Int? = null, order: Int? = id) =
    MuscleGroup(id, name, name.lowercase(), parentId, level = if (parentId == null) 1 else 2, displayOrder = order)
