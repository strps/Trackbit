package com.trackbit.core.data

import com.trackbit.core.data.di.DataScope
import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.database.entity.ConfigPart
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.Habit
import com.trackbit.core.model.HabitOrder
import com.trackbit.core.model.HabitReorderRequest
import com.trackbit.core.model.HabitRequest
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.service.HabitsService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The habits config. Reads come from Room, which [refresh] and the background sync fill, so the
 * screens work offline. Writes still need a connection (F4 moves them to the outbox): each goes
 * to the server and its answer into Room, then a sync brings the tracker's summary (and the
 * widgets) up to date in the background, so a closed screen doesn't cancel it.
 */
interface HabitsRepository {
    /** Every habit with its own color stops and `frozen`, by order; null until Room holds the habits config. */
    fun habits(): Flow<List<Habit>?>

    /** The role's caps; null when nothing is capped, or until they're pulled. */
    fun limits(): Flow<EffectiveLimits?>

    /** Pulls the habits config and the limits into Room. */
    suspend fun refresh(): SyncResult

    /** [request] names the new habit by its uuid, picked once per form so a retry can't create it twice. */
    suspend fun create(request: HabitRequest): ConfigResult<Habit>

    suspend fun update(uuid: String, request: HabitRequest): ConfigResult<Habit>

    /** Deletes the habit with all its logs and sessions. One already gone counts as deleted. */
    suspend fun delete(uuid: String): ConfigResult<Unit>

    /** Every habit's group and order, as the list now shows them. */
    suspend fun reorder(order: List<HabitOrder>): ConfigResult<Unit>
}

internal class DefaultHabitsRepository @Inject constructor(
    private val db: TrackbitDatabase,
    private val habitsService: HabitsService,
    private val sync: TrackerSync,
    @DataScope private val scope: CoroutineScope,
) : HabitsRepository {
    override fun habits(): Flow<List<Habit>?> =
        combine(db.configDao().observePulled(ConfigPart.Habits), db.habitDao().observeAll()) { pulled, rows ->
            if (pulled) rows.map { it.toHabit() } else null
        }

    override fun limits(): Flow<EffectiveLimits?> = db.configDao().observeLimits().map { it?.effective }

    override suspend fun refresh() = sync.syncConfig(ConfigPart.Habits, ConfigPart.Limits)

    override suspend fun create(request: HabitRequest): ConfigResult<Habit> {
        requireNotNull(request.uuid) { "A create names its habit" }
        return synced(request, sync.write({ habitsService.create(request) }) { storeHabit(it) })
    }

    override suspend fun update(uuid: String, request: HabitRequest) =
        synced(request, sync.write({ habitsService.update(uuid, request.copy(uuid = null)) }) { storeHabit(it) })

    override suspend fun delete(uuid: String) = synced(null, sync.delete({ habitsService.delete(uuid) }) { removeHabit(uuid) })

    override suspend fun reorder(order: List<HabitOrder>) =
        synced(null, sync.write({ habitsService.reorder(HabitReorderRequest(order)) }) { storeHabitOrder(order) })

    /** After a write: `/today` brings a new habit's summary, and every habit's `frozen` (a write can move the cap). */
    private fun <T> synced(request: HabitRequest?, result: ApiResult<T>): ConfigResult<T> {
        if (result is ApiResult.Success) scope.launch { sync.sync() }
        return result.toConfigResult(request?.type)
    }
}
