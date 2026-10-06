package com.trackbit.feature.exerciselibrary

import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.ExerciseLibraryRepository
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseRequest
import com.trackbit.core.model.LastPerformance
import com.trackbit.core.model.LimitCounts
import com.trackbit.core.model.LimitsResponse
import com.trackbit.core.model.MuscleGroup
import com.trackbit.core.model.MuscleGroupRef
import kotlinx.coroutines.yield

/** Answers from its fields; a non-null [failWith] fails the next calls. Suspends, like the network. */
class FakeExerciseLibraryRepository : ExerciseLibraryRepository {
    var exercises = listOf<Exercise>()
    var muscleGroups = listOf<MuscleGroup>()
    var limits: EffectiveLimits? = null
    var failWith: ConfigError? = null
    val created = mutableListOf<ExerciseRequest>()
    val updated = mutableListOf<Pair<String, ExerciseRequest>>()
    val deleted = mutableListOf<String>()

    private suspend fun <T> answer(value: () -> T): ConfigResult<T> {
        yield()
        return failWith?.let { ConfigResult.Failure(it) } ?: ConfigResult.Success(value())
    }

    override suspend fun exercises() = answer { exercises }

    override suspend fun muscleGroups() = answer { muscleGroups }

    override suspend fun limits() = answer { LimitsResponse(limits, LimitCounts(0, exercises.count { it.userId != null }, 0)) }

    /** Every create sent, refused ones included. */
    override suspend fun create(request: ExerciseRequest): ConfigResult<Exercise> {
        created += request
        return answer { exercise(100, request.name, mine = true).copy(uuid = request.uuid!!) }
    }

    override suspend fun update(uuid: String, request: ExerciseRequest) = answer {
        updated += uuid to request
        exercise(100, request.name, mine = true).copy(uuid = uuid)
    }

    override suspend fun delete(uuid: String) = answer { deleted += uuid }
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
