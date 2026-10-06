package com.trackbit.core.data

import com.trackbit.core.data.di.DataScope
import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.database.entity.ConfigPart
import com.trackbit.core.model.AppendListItemRequest
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.ExerciseListItemsRequest
import com.trackbit.core.model.ExerciseListItemsResponse
import com.trackbit.core.model.ExerciseListReorderRequest
import com.trackbit.core.model.ExerciseListRequest
import com.trackbit.core.model.ListItemDraft
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.service.ExerciseListService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.launch
import java.time.Clock
import javax.inject.Inject

/**
 * The user's exercise lists. Reads come from Room, which [refresh] and the background sync fill,
 * so the screens work offline. Writes still need a connection (F6 moves them to the outbox):
 * each goes to the server and its answer into Room. Lists are also the picker's sources, so
 * after a write Room's sources and cached queues (the picker, and the prescriptions new sets
 * start from) catch up in the background, where a closed screen doesn't cancel it.
 */
interface ExerciseListsRepository {
    /** Every list with its items, in order; null until Room holds the lists. */
    fun lists(): Flow<List<ExerciseList>?>

    /** Pulls the lists and the limits into Room. */
    suspend fun refresh(): SyncResult

    /** [request] names the new list by its uuid, picked once per form so a retry can't create it twice. */
    suspend fun create(request: ExerciseListRequest): ConfigResult<ExerciseList>

    /** Renames the list; a frozen one fails with [ConfigError.ExerciseListFrozen]. */
    suspend fun update(uuid: String, request: ExerciseListRequest): ConfigResult<ExerciseList>

    /** Every list in its new order. Frozen lists must stay at the end. */
    suspend fun reorder(uuids: List<String>): ConfigResult<List<ExerciseList>>

    /** Deletes the list (frozen too); logs made from it keep their exercise. One already gone counts as deleted. */
    suspend fun delete(uuid: String): ConfigResult<Unit>

    /** Replaces the list's items with [items], in this order, prescriptions included. */
    suspend fun saveItems(uuid: String, items: List<ListItemDraft>): ConfigResult<ExerciseListItemsResponse>

    /** Appends [exerciseUuid] at the end of list [uuid] as a new item, unprescribed. */
    suspend fun append(uuid: String, exerciseUuid: String): ConfigResult<ExerciseListItemsResponse>
}

internal class DefaultExerciseListsRepository @Inject constructor(
    private val db: TrackbitDatabase,
    private val service: ExerciseListService,
    private val sync: TrackerSync,
    private val clock: Clock,
    @DataScope private val scope: CoroutineScope,
) : ExerciseListsRepository {
    private val config = db.configDao()

    override fun lists(): Flow<List<ExerciseList>?> =
        combine(config.observePulled(ConfigPart.Lists), config.observeLists()) { pulled, rows ->
            if (pulled) rows.map { it.toExerciseList() } else null
        }

    override suspend fun refresh() = sync.syncConfig(ConfigPart.Lists, ConfigPart.Limits)

    override suspend fun create(request: ExerciseListRequest): ConfigResult<ExerciseList> {
        requireNotNull(request.uuid) { "A create names its list" }
        return synced(sync.write({ service.create(request) }) { storeList(it) })
    }

    override suspend fun update(uuid: String, request: ExerciseListRequest) =
        synced(sync.write({ service.update(uuid, request.copy(uuid = null)) }) { storeList(it) })

    /** The answer holds every list with its items, as a pull would. */
    override suspend fun reorder(uuids: List<String>) =
        synced(sync.write({ service.reorder(ExerciseListReorderRequest(uuids)) }) { applyLists(it, clock.instant()) })

    override suspend fun delete(uuid: String) = synced(sync.delete({ service.delete(uuid) }) { removeList(uuid) })

    override suspend fun saveItems(uuid: String, items: List<ListItemDraft>) =
        synced(sync.write({ service.putItems(uuid, ExerciseListItemsRequest.of(items)) }) { storeListItems(it) })

    override suspend fun append(uuid: String, exerciseUuid: String) =
        synced(sync.write({ service.append(uuid, AppendListItemRequest(newUuid(), exerciseUuid)) }) { storeListItems(it) })

    private fun <T> synced(result: ApiResult<T>): ConfigResult<T> {
        if (result is ApiResult.Success) scope.launch { sync.syncSources() }
        return result.toConfigResult()
    }
}
