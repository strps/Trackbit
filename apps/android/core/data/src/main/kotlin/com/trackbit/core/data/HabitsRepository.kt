package com.trackbit.core.data

import com.trackbit.core.data.di.DataScope
import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.model.Habit
import com.trackbit.core.model.HabitOrder
import com.trackbit.core.model.HabitReorderRequest
import com.trackbit.core.model.HabitRequest
import com.trackbit.core.model.LimitsResponse
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.safeCall
import com.trackbit.core.network.service.HabitsService
import com.trackbit.core.network.service.MeService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The habits config. Unlike tracking, it needs a connection (plan decision D3): every call goes
 * to the server, and nothing is queued. After a write succeeds, a sync brings Room (the tracker
 * and the widgets) up to date in the background, so a closed screen doesn't cancel it.
 */
interface HabitsRepository {
    /** Every habit with its own color stops and `frozen`, which Room's tracker copy doesn't keep. */
    suspend fun habits(): ConfigResult<List<Habit>>

    /** The role's caps and the user's counts. */
    suspend fun limits(): ConfigResult<LimitsResponse>

    /** [request] names the new habit by its uuid, picked once per form so a retry can't create it twice. */
    suspend fun create(request: HabitRequest): ConfigResult<Habit>

    suspend fun update(uuid: String, request: HabitRequest): ConfigResult<Habit>

    /** Deletes the habit with all its logs and sessions. */
    suspend fun delete(uuid: String): ConfigResult<Unit>

    /** Every habit's group and order, as the list now shows them. */
    suspend fun reorder(order: List<HabitOrder>): ConfigResult<Unit>
}

internal class DefaultHabitsRepository @Inject constructor(
    private val habitsService: HabitsService,
    private val meService: MeService,
    private val sync: TrackerSync,
    @DataScope private val scope: CoroutineScope,
) : HabitsRepository {
    override suspend fun habits() = safeCall { habitsService.habits() }.toConfigResult()

    override suspend fun limits() = safeCall { meService.limits() }.toConfigResult()

    override suspend fun create(request: HabitRequest): ConfigResult<Habit> {
        requireNotNull(request.uuid) { "A create names its habit" }
        return write(request) { habitsService.create(request) }
    }

    override suspend fun update(uuid: String, request: HabitRequest) =
        write(request) { habitsService.update(uuid, request.copy(uuid = null)) }

    override suspend fun delete(uuid: String) = write { habitsService.delete(uuid) }

    override suspend fun reorder(order: List<HabitOrder>) = write { habitsService.reorder(HabitReorderRequest(order)) }

    private suspend fun <T> write(request: HabitRequest? = null, call: suspend () -> T): ConfigResult<T> {
        val result = safeCall(call)
        if (result is ApiResult.Success) scope.launch { sync.sync() }
        return result.toConfigResult(request?.type)
    }
}
