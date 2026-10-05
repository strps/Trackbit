package com.trackbit.feature.exerciselibrary

import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.ExerciseListsRepository
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.ExerciseListItem
import com.trackbit.core.model.ExerciseListItemsResponse
import com.trackbit.core.model.ExerciseListRequest
import com.trackbit.core.model.ListItemDraft
import kotlinx.coroutines.yield

/**
 * A server holding [lists]: writes change them as the API would (new items get the next id). A
 * non-null [failWith] fails the next calls. Suspends, like the network.
 */
class FakeExerciseListsRepository : ExerciseListsRepository {
    var lists = listOf<ExerciseList>()
    var failWith: ConfigError? = null
    val calls = mutableListOf<String>()
    private var nextItemId = 1000

    private suspend fun <T> answer(call: String, value: () -> T): ConfigResult<T> {
        yield()
        calls += call
        return failWith?.let { ConfigResult.Failure(it) } ?: ConfigResult.Success(value())
    }

    private fun replace(id: Int, change: (ExerciseList) -> ExerciseList): ExerciseList {
        val list = change(lists.single { it.id == id })
        lists = lists.map { if (it.id == id) list else it }
        return list
    }

    override suspend fun lists() = answer("lists") { lists }

    override suspend fun create(request: ExerciseListRequest) = answer("create") {
        exerciseList((lists.maxOfOrNull { it.id } ?: 0) + 1, request.name, request.description).also { lists = lists + it }
    }

    override suspend fun update(id: Int, request: ExerciseListRequest) = answer("update $id") {
        replace(id) { it.copy(name = request.name, description = request.description) }
    }

    override suspend fun reorder(ids: List<Int>) = answer("reorder $ids") {
        lists = ids.mapIndexed { i, id -> lists.single { it.id == id }.copy(position = i) }
        lists
    }

    override suspend fun delete(id: Int) = answer("delete $id") { lists = lists.filterNot { it.id == id } }

    override suspend fun saveItems(id: Int, items: List<ListItemDraft>) = answer("save $id ${items.map { it.exerciseId }}") {
        val list = replace(id) { list ->
            list.copy(items = items.mapIndexed { i, d -> item(d.id ?: nextItemId++, id, d.exerciseId, i).withTargets(d) })
        }
        ExerciseListItemsResponse(id, list.items)
    }

    override suspend fun append(id: Int, exerciseId: Int) = answer("append $id $exerciseId") {
        val list = replace(id) { it.copy(items = it.items + item(nextItemId++, id, exerciseId, it.items.size)) }
        ExerciseListItemsResponse(id, list.items)
    }
}

fun exerciseList(id: Int, name: String = "List $id", description: String? = null, items: List<ExerciseListItem> = emptyList(), frozen: Boolean = false) =
    ExerciseList(id, "user", "user", name, description, position = id, createdAt = null, updatedAt = null, items = items, frozen = frozen)

fun item(id: Int, listId: Int, exerciseId: Int, position: Int) =
    ExerciseListItem(id, listId, exerciseId, position, null, null, null, null, null, null, null)

private fun ExerciseListItem.withTargets(d: ListItemDraft): ExerciseListItem {
    val p = d.prescription
    return copy(
        targetSets = p.targetSets, targetReps = p.targetReps, targetWeight = p.targetWeight, targetDuration = p.targetDuration,
        targetDistance = p.targetDistance, restSeconds = p.restSeconds, notes = p.notes,
    )
}
