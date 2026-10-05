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
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class ListEditorUiState(
    val loading: Boolean = true,
    /** Offline, or the list is gone or isn't the user's. */
    val loadFailed: Boolean = false,
    /** The list as last loaded or saved; its items are [items]. */
    val list: ExerciseList? = null,
    /** In order. Shows a change at once; a refused write puts the server's back. */
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
    val editingItem: Int? = null,
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

    fun exercise(id: Int): Exercise? = exercises.find { it.id == id }
}

/**
 * One list's editor, the web's `ExerciseListEditor` plus each item's targets (the prescription
 * the session's new sets start from): add exercises, drag to reorder, remove, rename, delete.
 * Every item change is saved at once. Writes go one at a time, each applied to the server's
 * latest items, so an add and a reorder in flight together can't overwrite each other.
 */
@HiltViewModel
class ListEditorViewModel @Inject constructor(
    private val repository: ExerciseListsRepository,
    private val library: ExerciseLibraryRepository,
    auth: AuthRepository,
    savedState: SavedStateHandle,
) : ViewModel() {
    private val listId: Int = checkNotNull(savedState[LIST_ID])

    private val _state = MutableStateFlow(ListEditorUiState())

    val state: StateFlow<ListEditorUiState> = combine(_state, auth.state) { state, auth ->
        val units = (auth as? AuthState.SignedIn)?.user?.unitSystem
        state.copy(units = units?.takeIf { it != UnitSystem.Unknown } ?: UnitSystem.Metric)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), _state.value)

    /** The items the server has. */
    private var saved: List<ExerciseListItem> = emptyList()
    private val writes = Mutex()
    private var dragging = false

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, loadFailed = false) }
        viewModelScope.launch {
            val exercises = async { library.exercises() }
            val list = when (val lists = repository.lists()) {
                is ConfigResult.Success -> lists.value.find { it.id == listId } ?: return@launch fail(ListsMessage.NotFound)
                is ConfigResult.Failure -> return@launch fail(lists.error.toListsMessage())
            }
            when (val loaded = exercises.await()) {
                is ConfigResult.Success -> {
                    saved = list.items
                    val collator = Collator.getInstance()
                    _state.update {
                        it.copy(
                            loading = false,
                            list = list,
                            items = saved,
                            exercises = loaded.value.sortedWith(compareBy(collator) { e -> e.name }),
                        )
                    }
                }
                is ConfigResult.Failure -> fail(loaded.error.toListsMessage())
            }
        }
    }

    private fun fail(message: ListsMessage) = _state.update { it.copy(loading = false, loadFailed = true, message = message) }

    // Items --------------------------------------------------------------------------------------

    /** A drag passed [to]: the dragged item ([from]) takes its place. */
    fun move(from: Int, to: Int) {
        if (!_state.value.editable) return
        dragging = true
        _state.update { state ->
            val items = state.items.toMutableList()
            val fromIndex = items.indexOfFirst { it.id == from }
            val toIndex = items.indexOfFirst { it.id == to }
            if (fromIndex < 0 || toIndex < 0) return@update state
            items.add(toIndex, items.removeAt(fromIndex))
            state.copy(items = items)
        }
    }

    /** The drag ended: saves the new order. */
    fun drop() {
        dragging = false
        val order = _state.value.items.map { it.id }
        if (order == saved.map { it.id }) return
        saveItems { items ->
            // Items appended meanwhile (not in [order]) keep their place at the end.
            items.sortedBy { item -> order.indexOf(item.id).takeIf { it >= 0 } ?: Int.MAX_VALUE }
        }
    }

    fun remove(itemId: Int) {
        if (!_state.value.editable) return
        saveItems { items -> items.filterNot { it.id == itemId } }
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

    /** Appends [exerciseId] at the end (a list may hold an exercise twice: a top set and a backoff). */
    fun add(exerciseId: Int) {
        _state.update { it.copy(adding = false) }
        if (!_state.value.editable) return
        viewModelScope.launch {
            writes.withLock {
                when (val result = repository.append(listId, exerciseId)) {
                    is ConfigResult.Success -> saved = result.value.items
                    is ConfigResult.Failure -> _state.update { it.copy(message = result.error.toListsMessage()) }
                }
                showSaved()
            }
        }
    }

    fun editTargets(itemId: Int) {
        if (_state.value.editable) _state.update { it.copy(editingItem = itemId) }
    }

    fun stopEditingTargets() = _state.update { it.copy(editingItem = null) }

    fun saveTargets(itemId: Int, prescription: Prescription) {
        _state.update { it.copy(editingItem = null) }
        if (!_state.value.editable || ExerciseListRules.problems(prescription).isNotEmpty()) return
        saveItems { items -> items.map { if (it.id == itemId) it.with(prescription) else it } }
    }

    /**
     * Shows [change] at once, then saves it applied to the server's items as they are when its
     * turn comes. A refusal shows the server's items again.
     */
    private fun saveItems(change: (List<ExerciseListItem>) -> List<ExerciseListItem>) {
        _state.update { it.copy(items = change(it.items)) }
        viewModelScope.launch {
            writes.withLock {
                val items = change(saved)
                if (items != saved) {
                    when (val result = repository.saveItems(listId, items.map { it.draft })) {
                        is ConfigResult.Success -> saved = result.value.items
                        is ConfigResult.Failure -> _state.update { it.copy(message = result.error.toListsMessage()) }
                    }
                }
                showSaved()
            }
        }
    }

    /** Shows the server's items, unless a drag is reordering them. */
    private fun showSaved() {
        if (!dragging) _state.update { it.copy(items = saved, list = it.list?.copy(items = saved)) }
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
            when (val result = repository.update(listId, request)) {
                is ConfigResult.Success -> _state.update {
                    it.copy(busy = false, renaming = null, list = it.list?.copy(name = result.value.name, description = result.value.description))
                }
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
            when (val result = repository.delete(listId)) {
                is ConfigResult.Success -> _state.update { it.copy(busy = false, done = true) }
                // Already gone: what the user wanted.
                is ConfigResult.Failure -> _state.update {
                    if (result.error == ConfigError.NotFound) {
                        it.copy(busy = false, done = true)
                    } else {
                        it.copy(busy = false, message = result.error.toListsMessage())
                    }
                }
            }
        }
    }

    fun onMessageShown(message: ListsMessage) {
        _state.update { if (it.message == message) it.copy(message = null) else it }
    }

    companion object {
        /** The route's argument. */
        const val LIST_ID = "listId"
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
