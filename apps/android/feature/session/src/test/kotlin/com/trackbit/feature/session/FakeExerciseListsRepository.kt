package com.trackbit.feature.session

import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.ExerciseListsRepository
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.ExerciseListItem
import com.trackbit.core.model.ExerciseListItemsResponse
import com.trackbit.core.model.ExerciseListRequest
import com.trackbit.core.model.ListItemDraft
import kotlinx.coroutines.yield

// Fixtures are numbered for readability; these are the uuids the app names them by.
fun listUuid(n: Int) = "list-$n"
fun itemUuid(n: Int) = "item-$n"
fun exerciseUuid(n: Int) = "exercise-$n"

/**
 * A server holding [lists]: writes change them as the API would (an append makes a new item). A
 * non-null [failWith] fails the next calls. Suspends, like the network.
 */
class FakeExerciseListsRepository : ExerciseListsRepository {
    var lists = listOf<ExerciseList>()
    var failWith: ConfigError? = null
    val calls = mutableListOf<String>()
    private var nextItem = 1000

    private suspend fun <T> answer(call: String, value: () -> T): ConfigResult<T> {
        yield()
        calls += call
        return failWith?.let { ConfigResult.Failure(it) } ?: ConfigResult.Success(value())
    }

    private fun replace(uuid: String, change: (ExerciseList) -> ExerciseList): ExerciseList {
        val list = change(lists.single { it.uuid == uuid })
        lists = lists.map { if (it.uuid == uuid) list else it }
        return list
    }

    override suspend fun lists() = answer("lists") { lists }

    override suspend fun create(request: ExerciseListRequest) = answer("create") {
        exerciseList(lists.size + 1, request.name, request.description).copy(uuid = request.uuid!!).also { lists = lists + it }
    }

    override suspend fun update(uuid: String, request: ExerciseListRequest) = answer("update $uuid") {
        replace(uuid) { it.copy(name = request.name, description = request.description) }
    }

    override suspend fun reorder(uuids: List<String>) = answer("reorder $uuids") {
        lists = uuids.mapIndexed { i, uuid -> lists.single { it.uuid == uuid }.copy(position = i) }
        lists
    }

    override suspend fun delete(uuid: String) = answer("delete $uuid") { lists = lists.filterNot { it.uuid == uuid } }

    override suspend fun saveItems(uuid: String, items: List<ListItemDraft>) = answer("save $uuid ${items.map { it.exerciseUuid }}") {
        val list = replace(uuid) { list ->
            list.copy(items = items.mapIndexed { i, d -> ExerciseListItem(d.uuid, d.exerciseUuid, i, null, null, null, null, null, null, null).withTargets(d) })
        }
        ExerciseListItemsResponse(uuid, list.items)
    }

    override suspend fun append(uuid: String, exerciseUuid: String) = answer("append $uuid $exerciseUuid") {
        val list = replace(uuid) {
            it.copy(items = it.items + ExerciseListItem(itemUuid(nextItem++), exerciseUuid, it.items.size, null, null, null, null, null, null, null))
        }
        ExerciseListItemsResponse(uuid, list.items)
    }
}

fun exerciseList(n: Int, name: String = "List $n", description: String? = null, items: List<ExerciseListItem> = emptyList(), frozen: Boolean = false) =
    ExerciseList(listUuid(n), "user", "user", name, description, position = n, createdAt = null, updatedAt = null, items = items, frozen = frozen)

fun item(n: Int, exercise: Int, position: Int) =
    ExerciseListItem(itemUuid(n), exerciseUuid(exercise), position, null, null, null, null, null, null, null)

private fun ExerciseListItem.withTargets(d: ListItemDraft): ExerciseListItem {
    val p = d.prescription
    return copy(
        targetSets = p.targetSets, targetReps = p.targetReps, targetWeight = p.targetWeight, targetDuration = p.targetDuration,
        targetDistance = p.targetDistance, restSeconds = p.restSeconds, notes = p.notes,
    )
}
