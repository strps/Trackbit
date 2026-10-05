package com.trackbit.feature.exerciselists

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.ExerciseLibraryRepository
import com.trackbit.core.data.ExerciseListsRepository
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.ExerciseListRequest
import com.trackbit.core.model.ExerciseListRules
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ExerciseListsUiState(
    /** In the user's order. Null until the first load. */
    val lists: List<ExerciseList>? = null,
    /** The first load failed: show a retry instead of the lists. */
    val loadFailed: Boolean = false,
    /** Null when nothing is capped, or until the limits load. */
    val limits: EffectiveLimits? = null,
    val refreshing: Boolean = false,
    /** The new list dialog is open. */
    val creating: ListForm? = null,
    val busy: Boolean = false,
    val message: ListsMessage? = null,
    /** A list was just created: the screen opens it. */
    val created: Int? = null,
) {
    val atListCap: Boolean
        get() = limits?.maxExerciseLists?.let { max -> lists.orEmpty().size >= max } ?: false
}

/** The name and description a list dialog edits. */
data class ListForm(
    val name: String = "",
    val description: String = "",
    /** Problems show only after a first save attempt, as on the web. */
    val showProblems: Boolean = false,
    /** The server refused the name as a duplicate; cleared when the name changes. */
    val nameTaken: Boolean = false,
) {
    val problems: Set<ExerciseListRules.Problem> get() = ExerciseListRules.problems(name, description)

    /** Null while [problems] isn't empty. A blank description clears it. */
    fun request(): ExerciseListRequest? =
        if (problems.isNotEmpty()) null else ExerciseListRequest(name.trim(), description.trim().ifEmpty { null })

    fun edit(name: String = this.name, description: String = this.description) =
        copy(name = name, description = description, nameTaken = nameTaken && name == this.name)

    companion object {
        fun of(list: ExerciseList) = ListForm(list.name, list.description.orEmpty())
    }
}

sealed interface ListsMessage {
    data object Offline : ListsMessage
    data object Failed : ListsMessage
    data object Frozen : ListsMessage
    data object NotFound : ListsMessage
    data class LimitReached(val maxExerciseLists: Int) : ListsMessage
    data class Full(val maxItems: Int) : ListsMessage
}

internal fun ConfigError.toListsMessage(): ListsMessage = when (this) {
    ConfigError.Offline -> ListsMessage.Offline
    ConfigError.ExerciseListFrozen -> ListsMessage.Frozen
    ConfigError.NotFound -> ListsMessage.NotFound
    is ConfigError.ExerciseListLimitReached -> ListsMessage.LimitReached(maxExerciseLists)
    is ConfigError.ExerciseListFull -> ListsMessage.Full(maxItems)
    else -> ListsMessage.Failed
}

/**
 * The user's exercise lists, like the web's `/config/lists` rail: in order, reordered by dragging,
 * created from a dialog. Tapping one opens its editor. It reads the server (config needs a
 * connection) and reloads on resume, which also picks up the editor's changes.
 */
@HiltViewModel
class ExerciseListsViewModel @Inject constructor(
    private val repository: ExerciseListsRepository,
    private val library: ExerciseLibraryRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(ExerciseListsUiState())
    val state: StateFlow<ExerciseListsUiState> = _state.asStateFlow()

    /** The order the server has; a failed reorder returns to it. */
    private var saved: List<ExerciseList> = emptyList()
    private var dragging = false

    fun refresh() {
        if (_state.value.refreshing) return
        _state.update { it.copy(refreshing = true) }
        viewModelScope.launch {
            val limits = async { library.limits() }
            when (val lists = repository.lists()) {
                is ConfigResult.Success -> {
                    saved = lists.value
                    // A drag in progress keeps its own order; the drop reconciles with [saved].
                    _state.update { it.copy(lists = if (dragging) it.lists else saved, loadFailed = false) }
                }
                is ConfigResult.Failure -> _state.update {
                    it.copy(loadFailed = it.lists == null, message = lists.error.toListsMessage())
                }
            }
            val effective = (limits.await() as? ConfigResult.Success)?.value?.effective
            _state.update { it.copy(limits = effective ?: it.limits, refreshing = false) }
        }
    }

    /** A drag passed [to]: the dragged list ([from]) takes its place. */
    fun move(from: Int, to: Int) {
        dragging = true
        _state.update { state ->
            val lists = state.lists?.toMutableList() ?: return@update state
            val fromIndex = lists.indexOfFirst { it.id == from }
            val toIndex = lists.indexOfFirst { it.id == to }
            if (fromIndex < 0 || toIndex < 0) return@update state
            lists.add(toIndex, lists.removeAt(fromIndex))
            state.copy(lists = lists)
        }
    }

    /** The drag ended: sends the new order, or puts the old one back if it can't be. */
    fun drop() {
        dragging = false
        val lists = _state.value.lists ?: return
        if (lists.map { it.id } == saved.map { it.id }) return
        // The freeze walks the order, so frozen lists stay at the end (the server refuses otherwise).
        if (lists.dropWhile { !it.frozen }.any { !it.frozen }) {
            _state.update { it.copy(lists = saved, message = ListsMessage.Frozen) }
            return
        }
        viewModelScope.launch {
            when (val result = repository.reorder(lists.map { it.id })) {
                is ConfigResult.Success -> {
                    saved = result.value
                    if (!dragging) _state.update { it.copy(lists = saved) }
                }
                is ConfigResult.Failure -> _state.update { it.copy(lists = saved, message = result.error.toListsMessage()) }
            }
        }
    }

    /** The add button: opens the dialog, or says why it can't at the cap. */
    fun startCreate() {
        val state = _state.value
        val max = state.limits?.maxExerciseLists
        if (state.atListCap && max != null) {
            _state.update { it.copy(message = ListsMessage.LimitReached(max)) }
        } else {
            _state.update { it.copy(creating = ListForm()) }
        }
    }

    fun editCreate(change: (ListForm) -> ListForm) = _state.update { state ->
        state.copy(creating = state.creating?.let(change))
    }

    fun cancelCreate() = _state.update { it.copy(creating = null) }

    fun create() {
        val form = _state.value.creating ?: return
        if (_state.value.busy) return
        val request = form.request() ?: return _state.update { it.copy(creating = form.copy(showProblems = true)) }
        _state.update { it.copy(busy = true) }
        viewModelScope.launch {
            when (val result = repository.create(request)) {
                is ConfigResult.Success -> {
                    saved = saved + result.value
                    _state.update { it.copy(busy = false, creating = null, lists = saved, created = result.value.id) }
                }
                is ConfigResult.Failure -> _state.update { state ->
                    // A taken name shows under the field and keeps the dialog open, as on the web.
                    if (result.error == ConfigError.ExerciseListNameTaken) {
                        state.copy(busy = false, creating = state.creating?.copy(nameTaken = true))
                    } else {
                        state.copy(busy = false, message = result.error.toListsMessage())
                    }
                }
            }
        }
    }

    fun onCreatedOpened() = _state.update { it.copy(created = null) }

    fun onMessageShown(message: ListsMessage) {
        _state.update { if (it.message == message) it.copy(message = null) else it }
    }
}
