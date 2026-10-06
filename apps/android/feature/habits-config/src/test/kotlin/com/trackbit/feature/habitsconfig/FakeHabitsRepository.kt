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
    val updated = mutableListOf<Pair<String, HabitRequest>>()
    val deleted = mutableListOf<String>()

    private suspend fun <T> answer(value: () -> T): ConfigResult<T> {
        yield()
        return failWith?.let { ConfigResult.Failure(it) } ?: ConfigResult.Success(value())
    }

    override suspend fun habits() = answer { habits }

    override suspend fun limits() = answer { LimitsResponse(limits, LimitCounts(habits.size, 0, 0)) }

    /** Every create sent, refused ones included. */
    override suspend fun create(request: HabitRequest): ConfigResult<Habit> {
        created += request
        return answer { habit(100, request.name).copy(uuid = request.uuid!!) }
    }

    override suspend fun update(uuid: String, request: HabitRequest) = answer {
        updated += uuid to request
        habit(100, request.name).copy(uuid = uuid)
    }

    override suspend fun delete(uuid: String) = answer { deleted += uuid }

    override suspend fun reorder(order: List<HabitOrder>) = answer { reorders += order }
}

// Fixtures are numbered for readability; this is the uuid the app names them by.
fun habitUuid(n: Int) = "habit-$n"

fun habit(
    n: Int,
    name: String = "Habit $n",
    type: HabitType = HabitType.Count,
    isAntiHabit: Boolean = false,
    order: Int = 0,
    frozen: Boolean = false,
    dailyGoal: Int = 3,
) = Habit(
    uuid = habitUuid(n),
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
