package com.trackbit.feature.exerciselists

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.ExerciseLibraryRepository
import com.trackbit.core.data.ExerciseListsRepository
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.ExerciseListItem
import com.trackbit.core.model.ExerciseListRules
import com.trackbit.core.model.Prescription
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.model.draft
import dagger.hilt.android.lifecycle.HiltViewModel
import java.text.Collator
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class ListEditorUiState(
    val loading: Boolean = true,
    /** Never pulled and offline, or the list is gone or isn't the user's. */
    val loadFailed: Boolean = false,
    /** Room's list; what the screen shows of its items is [items]. */
    val list: ExerciseList? = null,
    /** In order. Shows a change at once; once writes settle, Room's (the server's answer) again. */
    val items: List<ExerciseListItem> = emptyList(),
    /** Every exercise the user can add (system and own), sorted by name; also names the items. */
    val exercises: List<Exercise> = emptyList(),
    /** How weights show; they're stored in kg. */
    val units: UnitSystem = UnitSystem.Metric,
    /** The rename dialog is open. */
    val renaming: ListForm? = null,
    val confirmingDelete: Boolean = false,
    /** The exercise picker is open. */
    val adding: Boolean = false,
    /** The item whose targets are being edited. */
    val editingItem: String? = null,
    /** A rename or delete is in flight. */
    val busy: Boolean = false,
    val message: ListsMessage? = null,
    /** Deleted: the screen closes. */
    val done: Boolean = false,
) {
    /** Read-only: over the role's cap. It can still be deleted. */
    val frozen: Boolean get() = list?.frozen == true

    val editable: Boolean get() = list != null && !frozen

    val atItemCap: Boolean get() = items.size >= ExerciseListRules.MAX_ITEMS

    fun exercise(uuid: String): Exercise? = exercises.find { it.uuid == uuid }
}

/**
 * One list's editor, the web's `ExerciseListEditor` plus each item's targets (the prescription
 * the session's new sets start from): add exercises, drag to reorder, remove, rename, delete.
 * It shows Room's list, so it opens offline. Every item change shows at once and is saved at
 * once. Writes go one at a time, each applied to Room's items as the previous write left them
 * (its answer), so an add and a reorder in flight together can't overwrite each other.
 */
@HiltViewModel
class ListEditorViewModel @Inject constructor(
    private val repository: ExerciseListsRepository,
    private val library: ExerciseLibraryRepository,
    auth: AuthRepository,
    savedState: SavedStateHandle,
) : ViewModel() {
    private val listUuid: String = checkNotNull(savedState[LIST_UUID])

    private val _state = MutableStateFlow(ListEditorUiState())

    val state: StateFlow<ListEditorUiState> = combine(_state, auth.state) { state, auth ->
        val units = (auth as? AuthState.SignedIn)?.user?.unitSystem
        state.copy(units = units?.takeIf { it != UnitSystem.Unknown } ?: UnitSystem.Metric)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), _state.value)

    private val writes = Mutex()
    private var dragging = false

    /** Item writes shown but not settled: the items on screen are theirs until the last one is. */
    private var pendingWrites = 0

    /** [load] is deciding whether the list exists; until it has, a missing list isn't reported. */
    private var loadRunning = false

    init {
        viewModelScope.launch {
            combine(repository.lists(), library.exercises(), ::Pair).collect { (lists, exercises) ->
                if (lists == null || exercises == null) return@collect
                val list = lists.find { it.uuid == listUuid }
                val collator = Collator.getInstance()
                _state.update { state ->
                    when {
                        list != null -> state.copy(
                            loading = false,
                            loadFailed = false,
                            list = list,
                            items = if (dragging || pendingWrites > 0) state.items else list.items,
                            exercises = exercises.sortedWith(compareBy(collator) { e -> e.name }),
                        )
                        // Being loaded, deleted from here, or already reported.
                        loadRunning || state.busy || state.done || state.loadFailed -> state
                        // Deleted elsewhere.
                        else -> state.copy(loadFailed = true, list = null, message = ListsMessage.NotFound)
                    }
                }
            }
        }
        load()
    }

    /** Pulls the lists and the catalog if Room lacks them or this list (a first open, or a retry). */
    fun load() {
        viewModelScope.launch {
            loadRunning = true
            if (currentItems() == null || library.exercises().first() == null) {
                _state.update { it.copy(loading = true, loadFailed = false) }
                val result = maxOf(repository.refresh(), library.refresh())
                val missing = when {
                    repository.lists().first() == null || library.exercises().first() == null ->
                        result.toListsMessage() ?: ListsMessage.Failed
                    currentItems() == null -> ListsMessage.NotFound
                    else -> null
                }
                if (missing != null) _state.update { it.copy(loading = false, loadFailed = true, message = missing) }
            }
            loadRunning = false
        }
    }

    /** Room's items of the list, or null if it doesn't hold the list. */
    private suspend fun currentItems(): List<ExerciseListItem>? =
        repository.lists().first()?.find { it.uuid == listUuid }?.items

    // Items --------------------------------------------------------------------------------------

    /** A drag passed [to]: the dragged item ([from]) takes its place. */
    fun move(from: String, to: String) {
        if (!_state.value.editable) return
        dragging = true
        _state.update { state ->
            val items = state.items.toMutableList()
            val fromIndex = items.indexOfFirst { it.uuid == from }
            val toIndex = items.indexOfFirst { it.uuid == to }
            if (fromIndex < 0 || toIndex < 0) return@update state
            items.add(toIndex, items.removeAt(fromIndex))
            state.copy(items = items)
        }
    }

    /** The drag ended: saves the new order. */
    fun drop() {
        dragging = false
        val order = _state.value.items.map { it.uuid }
        if (order == _state.value.list?.items?.map { it.uuid }) return
        saveItems { items ->
            // Items appended meanwhile (not in [order]) keep their place at the end.
            items.sortedBy { item -> order.indexOf(item.uuid).takeIf { it >= 0 } ?: Int.MAX_VALUE }
        }
    }

    fun remove(itemUuid: String) {
        if (!_state.value.editable) return
        saveItems { items -> items.filterNot { it.uuid == itemUuid } }
    }

    fun startAdding() {
        val state = _state.value
        if (!state.editable) return
        if (state.atItemCap) {
            _state.update { it.copy(message = ListsMessage.Full(ExerciseListRules.MAX_ITEMS)) }
        } else {
            _state.update { it.copy(adding = true) }
        }
    }

    fun stopAdding() = _state.update { it.copy(adding = false) }

    /** Appends [exerciseUuid] at the end (a list may hold an exercise twice: a top set and a backoff). */
    fun add(exerciseUuid: String) {
        _state.update { it.copy(adding = false) }
        if (!_state.value.editable) return
        write {
            val result = repository.append(listUuid, exerciseUuid)
            if (result is ConfigResult.Failure) _state.update { it.copy(message = result.error.toListsMessage()) }
        }
    }

    fun editTargets(itemUuid: String) {
        if (_state.value.editable) _state.update { it.copy(editingItem = itemUuid) }
    }

    fun stopEditingTargets() = _state.update { it.copy(editingItem = null) }

    fun saveTargets(itemUuid: String, prescription: Prescription) {
        _state.update { it.copy(editingItem = null) }
        if (!_state.value.editable || ExerciseListRules.problems(prescription).isNotEmpty()) return
        saveItems { items -> items.map { if (it.uuid == itemUuid) it.with(prescription) else it } }
    }

    /**
     * Shows [change] at once, then saves it applied to Room's items as they are when its turn
     * comes. A refusal shows Room's items again.
     */
    private fun saveItems(change: (List<ExerciseListItem>) -> List<ExerciseListItem>) {
        _state.update { it.copy(items = change(it.items)) }
        write {
            val current = currentItems() ?: return@write
            val items = change(current)
            if (items != current) {
                val result = repository.saveItems(listUuid, items.map { it.draft })
                if (result is ConfigResult.Failure) _state.update { it.copy(message = result.error.toListsMessage()) }
            }
        }
    }

    /** Runs [block] after the writes before it; once the last one settles, shows Room's items unless a drag is reordering them. */
    private fun write(block: suspend () -> Unit) {
        pendingWrites++
        viewModelScope.launch {
            writes.withLock { block() }
            pendingWrites--
            if (pendingWrites == 0 && !dragging) {
                currentItems()?.let { items -> _state.update { it.copy(items = items) } }
            }
        }
    }

    // The list -----------------------------------------------------------------------------------

    fun startRename() {
        val list = _state.value.list ?: return
        if (_state.value.editable) _state.update { it.copy(renaming = ListForm.of(list)) }
    }

    fun editRename(change: (ListForm) -> ListForm) = _state.update { it.copy(renaming = it.renaming?.let(change)) }

    fun cancelRename() = _state.update { it.copy(renaming = null) }

    fun rename() {
        val state = _state.value
        val form = state.renaming ?: return
        if (state.busy) return
        val request = form.request() ?: return _state.update { it.copy(renaming = form.copy(showProblems = true)) }
        _state.update { it.copy(busy = true) }
        viewModelScope.launch {
            when (val result = repository.update(listUuid, request)) {
                // Room has the new name, and so [ListEditorUiState.list].
                is ConfigResult.Success -> _state.update { it.copy(busy = false, renaming = null) }
                is ConfigResult.Failure -> _state.update {
                    if (result.error == ConfigError.ExerciseListNameTaken) {
                        it.copy(busy = false, renaming = it.renaming?.copy(nameTaken = true))
                    } else {
                        it.copy(busy = false, message = result.error.toListsMessage())
                    }
                }
            }
        }
    }

    fun confirmDelete(show: Boolean) = _state.update { it.copy(confirmingDelete = show) }

    fun delete() {
        if (_state.value.busy) return
        _state.update { it.copy(busy = true, confirmingDelete = false) }
        viewModelScope.launch {
            // One already gone counts as deleted.
            when (val result = repository.delete(listUuid)) {
                is ConfigResult.Success -> _state.update { it.copy(busy = false, done = true) }
                is ConfigResult.Failure -> _state.update { it.copy(busy = false, message = result.error.toListsMessage()) }
            }
        }
    }

    fun onMessageShown(message: ListsMessage) {
        _state.update { if (it.message == message) it.copy(message = null) else it }
    }

    companion object {
        /** The route's argument. */
        const val LIST_UUID = "listUuid"
    }
}

private fun ExerciseListItem.with(p: Prescription) = copy(
    targetSets = p.targetSets,
    targetReps = p.targetReps,
    targetWeight = p.targetWeight,
    targetDuration = p.targetDuration,
    targetDistance = p.targetDistance,
    restSeconds = p.restSeconds,
    notes = p.notes?.trim()?.ifEmpty { null },
)
