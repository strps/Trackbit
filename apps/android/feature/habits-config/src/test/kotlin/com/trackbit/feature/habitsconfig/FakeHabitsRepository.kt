package com.trackbit.feature.habitsconfig

import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.HabitsRepository
import com.trackbit.core.data.SyncResult
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.GradientPresets
import com.trackbit.core.model.Habit
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitOrder
import com.trackbit.core.model.HabitRequest
import com.trackbit.core.model.HabitType
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.yield

/**
 * A server holding [habits] and [limits], and Room's copy of them, which [refresh] fills and
 * successful writes change as the real repository's answers do. A non-null [failWith] fails the
 * next calls (a refresh with [ConfigError.Offline] as offline). Suspends, like the network.
 */
class FakeHabitsRepository : HabitsRepository {
    var habits = listOf<Habit>()
    var limits: EffectiveLimits? = null
    var failWith: ConfigError? = null
    val reorders = mutableListOf<List<HabitOrder>>()
    val created = mutableListOf<HabitRequest>()
    val updated = mutableListOf<Pair<String, HabitRequest>>()
    val deleted = mutableListOf<String>()

    private val room = MutableStateFlow<List<Habit>?>(null)
    private val roomLimits = MutableStateFlow<EffectiveLimits?>(null)

    override fun habits(): Flow<List<Habit>?> = room.map { it?.sortedBy(Habit::order) }

    override fun limits(): Flow<EffectiveLimits?> = roomLimits

    override suspend fun refresh(): SyncResult {
        yield()
        return when (failWith) {
            null -> {
                room.value = habits
                roomLimits.value = limits
                SyncResult.Done
            }
            ConfigError.Offline -> SyncResult.Retry
            else -> SyncResult.Failed
        }
    }

    private suspend fun <T> answer(value: () -> T): ConfigResult<T> {
        yield()
        return failWith?.let { ConfigResult.Failure(it) } ?: ConfigResult.Success(value()).also { room.value = room.value?.let { habits } }
    }

    /** Every create sent, refused ones included. */
    override suspend fun create(request: HabitRequest): ConfigResult<Habit> {
        created += request
        return answer { habit(100, request.name).copy(uuid = request.uuid!!).also { habits = habits + it } }
    }

    override suspend fun update(uuid: String, request: HabitRequest) = answer {
        updated += uuid to request
        habit(100, request.name).copy(uuid = uuid).also { new -> habits = habits.map { if (it.uuid == uuid) new else it } }
    }

    override suspend fun delete(uuid: String) = answer {
        deleted += uuid
        habits = habits.filterNot { it.uuid == uuid }
    }

    override suspend fun reorder(order: List<HabitOrder>) = answer {
        reorders += order
        val byUuid = order.associateBy { it.uuid }
        habits = habits.map { habit -> byUuid[habit.uuid]?.let { habit.copy(order = it.order, isAntiHabit = it.isAntiHabit) } ?: habit }
    }
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
    frozen = frozen,
)
