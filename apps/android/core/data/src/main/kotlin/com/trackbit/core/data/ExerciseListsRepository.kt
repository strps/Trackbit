package com.trackbit.core.data

import com.trackbit.core.data.di.DataScope
import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.model.AppendListItemRequest
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.ExerciseListItemsRequest
import com.trackbit.core.model.ExerciseListItemsResponse
import com.trackbit.core.model.ExerciseListReorderRequest
import com.trackbit.core.model.ExerciseListRequest
import com.trackbit.core.model.ListItemDraft
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.safeCall
import com.trackbit.core.network.service.ExerciseListService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The user's exercise lists. Like the rest of the config it needs a connection: reads and writes
 * go to the server. Lists are also the picker's sources, so after a write succeeds Room's sources
 * and cached queues (the picker, and the prescriptions new sets start from) catch up in the
 * background, where a closed screen doesn't cancel it.
 */
interface ExerciseListsRepository {
    /** Every list with its items, in order. */
    suspend fun lists(): ConfigResult<List<ExerciseList>>

    suspend fun create(request: ExerciseListRequest): ConfigResult<ExerciseList>

    /** Renames the list; a frozen one fails with [ConfigError.ExerciseListFrozen]. */
    suspend fun update(id: Int, request: ExerciseListRequest): ConfigResult<ExerciseList>

    /** Every list in its new order. Frozen lists must stay at the end. */
    suspend fun reorder(ids: List<Int>): ConfigResult<List<ExerciseList>>

    /** Deletes the list (frozen too); logs made from it keep their exercise. */
    suspend fun delete(id: Int): ConfigResult<Unit>

    /** Replaces the list's items with [items], in this order, prescriptions included. */
    suspend fun saveItems(id: Int, items: List<ListItemDraft>): ConfigResult<ExerciseListItemsResponse>

    /** Appends [exerciseId] at the end of the list, unprescribed. */
    suspend fun append(id: Int, exerciseId: Int): ConfigResult<ExerciseListItemsResponse>
}

internal class DefaultExerciseListsRepository @Inject constructor(
    private val service: ExerciseListService,
    private val sync: TrackerSync,
    @DataScope private val scope: CoroutineScope,
) : ExerciseListsRepository {
    override suspend fun lists() = safeCall { service.lists() }.toConfigResult()

    override suspend fun create(request: ExerciseListRequest) = write { service.create(request) }

    override suspend fun update(id: Int, request: ExerciseListRequest) = write { service.update(id, request) }

    override suspend fun reorder(ids: List<Int>) = write { service.reorder(ExerciseListReorderRequest(ids)) }

    override suspend fun delete(id: Int) = write { service.delete(id) }

    override suspend fun saveItems(id: Int, items: List<ListItemDraft>) =
        write { service.putItems(id, ExerciseListItemsRequest.of(items)) }

    override suspend fun append(id: Int, exerciseId: Int) = write { service.append(id, AppendListItemRequest(exerciseId)) }

    private suspend fun <T> write(call: suspend () -> T): ConfigResult<T> {
        val result = safeCall(call)
        if (result is ApiResult.Success) scope.launch { sync.syncSources() }
        return result.toConfigResult()
    }
}
