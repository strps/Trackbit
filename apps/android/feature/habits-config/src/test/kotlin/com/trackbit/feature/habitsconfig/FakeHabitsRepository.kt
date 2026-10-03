package com.trackbit.feature.habitsconfig

import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.HabitsRepository
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.GradientPresets
import com.trackbit.core.model.Habit
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitOrder
import com.trackbit.core.model.HabitRequest
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.LimitCounts
import com.trackbit.core.model.LimitsResponse
import kotlinx.coroutines.yield

/** Answers from its fields; a non-null [failWith] fails the next calls. Suspends, like the network. */
class FakeHabitsRepository : HabitsRepository {
    var habits = listOf<Habit>()
    var limits: EffectiveLimits? = null
    var failWith: ConfigError? = null
    val reorders = mutableListOf<List<HabitOrder>>()
    val created = mutableListOf<HabitRequest>()
    val updated = mutableListOf<Pair<Int, HabitRequest>>()
    val deleted = mutableListOf<Int>()

    private suspend fun <T> answer(value: () -> T): ConfigResult<T> {
        yield()
        return failWith?.let { ConfigResult.Failure(it) } ?: ConfigResult.Success(value())
    }

    override suspend fun habits() = answer { habits }

    override suspend fun limits() = answer { LimitsResponse(limits, LimitCounts(habits.size, 0, 0)) }

    override suspend fun create(request: HabitRequest) = answer {
        created += request
        habit(100, request.name)
    }

    override suspend fun update(id: Int, request: HabitRequest) = answer {
        updated += id to request
        habit(id, request.name)
    }

    override suspend fun delete(id: Int) = answer { deleted += id }

    override suspend fun reorder(order: List<HabitOrder>) = answer { reorders += order }
}

fun habit(
    id: Int,
    name: String = "Habit $id",
    type: HabitType = HabitType.Count,
    isAntiHabit: Boolean = false,
    order: Int = 0,
    frozen: Boolean = false,
    dailyGoal: Int = 3,
) = Habit(
    id = id,
    userId = "user",
    name = name,
    description = null,
    type = type,
    isAntiHabit = isAntiHabit,
    colorTheme = ColorTheme.Blue,
    colorStops = GradientPresets.getValue(ColorTheme.Custom),
    icon = HabitIcon.Book,
    weeklyGoal = 5,
    dailyGoal = dailyGoal,
    order = order,
    createdAt = null,
    frozen = frozen,
)
