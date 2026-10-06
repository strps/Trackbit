package com.trackbit.feature.exerciselibrary

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.ExerciseLibraryRepository
import com.trackbit.core.data.ExerciseListsRepository
import com.trackbit.core.data.SyncResult
import com.trackbit.core.designsystem.component.ListTargets
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.MuscleGroup
import dagger.hilt.android.lifecycle.HiltViewModel
import java.text.Collator
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** The web's All / Custom / System toggle. */
enum class OwnerFilter { All, Custom, System }

data class ExerciseLibraryUiState(
    /** Sorted by name. Null until the first load. */
    val exercises: List<Exercise>? = null,
    /** The taxonomy, for the muscle filter; empty while it hasn't loaded (the filter hides). */
    val muscleGroups: List<MuscleGroup> = emptyList(),
    /** Room has no catalog and pulling it failed: show a retry instead of a list. */
    val loadFailed: Boolean = false,
    /** Null when nothing is capped, or until the limits load. */
    val limits: EffectiveLimits? = null,
    val refreshing: Boolean = false,
    val query: String = "",
    val owner: OwnerFilter = OwnerFilter.All,
    /** A top-level group: shows exercises that work it or any of its subdivisions. */
    val muscleGroupId: Int? = null,
    /** The user's lists, for "add to list". Null until Room holds them. */
    val lists: List<ExerciseList>? = null,
    val listsFailed: Boolean = false,
    val message: ExerciseLibraryMessage? = null,
) {
    /** The lists [exerciseUuid] can be added to: the unfrozen ones. */
    fun listTargets(exerciseUuid: String): ListTargets = ListTargets.of(lists, listsFailed, exerciseUuid)

    /** The top-level groups the filter offers, in the taxonomy's order. */
    val filterGroups: List<MuscleGroup> get() = muscleGroups.filter { it.parentId == null }.sortedWith(GROUP_ORDER)

    val visible: List<Exercise>
        get() {
            val needle = query.trim()
            val groups = muscleGroupId?.let { descendantsOf(it) }
            return exercises.orEmpty().filter { exercise ->
                (needle.isEmpty() || exercise.name.contains(needle, ignoreCase = true)) &&
                    when (owner) {
                        OwnerFilter.All -> true
                        OwnerFilter.Custom -> exercise.userId != null
                        OwnerFilter.System -> exercise.userId == null
                    } &&
                    (groups == null || exercise.muscleGroups.any { it.id in groups })
            }
        }

    val atExerciseCap: Boolean
        get() = limits?.maxCustomExercises?.let { max -> exercises.orEmpty().count { it.userId != null } >= max } ?: false

    /** [id] and every group under it. */
    private fun descendantsOf(id: Int): Set<Int> {
        val children = muscleGroups.groupBy({ it.parentId }, { it.id })
        val found = mutableSetOf(id)
        val pending = ArrayDeque(listOf(id))
        while (pending.isNotEmpty()) {
            children[pending.removeFirst()].orEmpty().forEach { if (found.add(it)) pending += it }
        }
        return found
    }
}

sealed interface ExerciseLibraryMessage {
    data object Offline : ExerciseLibraryMessage
    data object Failed : ExerciseLibraryMessage
    data class LimitReached(val maxCustomExercises: Int) : ExerciseLibraryMessage
    data class AddedToList(val listName: String) : ExerciseLibraryMessage
    data object ListFrozen : ExerciseLibraryMessage
    data class ListFull(val maxItems: Int) : ExerciseLibraryMessage
}

/** The taxonomy's order, then by name for groups without one. */
internal val GROUP_ORDER: Comparator<MuscleGroup> =
    compareBy<MuscleGroup, Int?>(nullsLast()) { it.displayOrder }.thenBy { it.name }

/**
 * The exercise library, like the web's `/config/exercises`: system exercises and the user's
 * own, searched by name and filtered by owner and muscle group. It shows Room's catalog, so it
 * works offline; the screen pulls it again on resume. The form's saves reach Room, and so the
 * library, by themselves.
 */
@HiltViewModel
class ExerciseLibraryViewModel @Inject constructor(
    private val repository: ExerciseLibraryRepository,
    private val lists: ExerciseListsRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(ExerciseLibraryUiState())
    val state: StateFlow<ExerciseLibraryUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repository.exercises().collect { exercises ->
                if (exercises == null) return@collect
                val collator = Collator.getInstance()
                _state.update { it.copy(exercises = exercises.sortedWith(compareBy(collator) { e -> e.name }), loadFailed = false) }
            }
        }
        viewModelScope.launch {
            repository.muscleGroups().collect { groups ->
                if (groups == null) return@collect
                _state.update { state ->
                    state.copy(
                        muscleGroups = groups,
                        // A filter on a group that's gone would hide everything.
                        muscleGroupId = state.muscleGroupId?.takeIf { id -> groups.any { it.id == id } },
                    )
                }
            }
        }
        viewModelScope.launch {
            repository.limits().collect { limits -> _state.update { it.copy(limits = limits) } }
        }
        viewModelScope.launch {
            lists.lists().collect { lists -> if (lists != null) _state.update { it.copy(lists = lists, listsFailed = false) } }
        }
    }

    /** Pulls the catalog, the muscle groups, the limits and the lists again; Room's copy stays on screen meanwhile. */
    fun refresh() {
        if (_state.value.refreshing) return
        _state.update { it.copy(refreshing = true) }
        viewModelScope.launch {
            launch { pullLists() }
            val result = repository.refresh()
            _state.update {
                it.copy(
                    refreshing = false,
                    loadFailed = it.exercises == null && result != SyncResult.Done,
                    message = result.toMessage() ?: it.message,
                )
            }
        }
    }

    /** The add-to-list menu opened: retries the lists if Room has none and pulling them failed. */
    fun onListsMenu() {
        if (_state.value.listsFailed) {
            _state.update { it.copy(listsFailed = false) }
            viewModelScope.launch { pullLists() }
        }
    }

    private suspend fun pullLists() {
        val result = lists.refresh()
        _state.update { it.copy(listsFailed = it.lists == null && result != SyncResult.Done) }
    }

    /** Appends [exerciseUuid] to [listUuid], like the web's add-to-list menu. The menus follow Room. */
    fun addToList(listUuid: String, exerciseUuid: String) {
        viewModelScope.launch {
            when (val result = lists.append(listUuid, exerciseUuid)) {
                is ConfigResult.Success -> _state.update { state ->
                    val name = state.lists?.find { it.uuid == listUuid }?.name.orEmpty()
                    state.copy(message = ExerciseLibraryMessage.AddedToList(name))
                }
                is ConfigResult.Failure -> _state.update { it.copy(message = result.error.toMessage()) }
            }
        }
    }

    fun search(query: String) = _state.update { it.copy(query = query) }

    fun filterOwner(owner: OwnerFilter) = _state.update { it.copy(owner = owner) }

    /** Null shows every muscle group. */
    fun filterMuscleGroup(id: Int?) = _state.update { it.copy(muscleGroupId = id) }

    /** The add button while at the cap: say why it does nothing. */
    fun onAddAtCap() {
        val max = _state.value.limits?.maxCustomExercises ?: return
        _state.update { it.copy(message = ExerciseLibraryMessage.LimitReached(max)) }
    }

    fun onMessageShown(message: ExerciseLibraryMessage) {
        _state.update { if (it.message == message) it.copy(message = null) else it }
    }

    private companion object {
        /** Null when there is nothing to say: done, or signed out. */
        fun SyncResult.toMessage(): ExerciseLibraryMessage? = when (this) {
            SyncResult.Retry -> ExerciseLibraryMessage.Offline
            SyncResult.Failed -> ExerciseLibraryMessage.Failed
            SyncResult.Done, SyncResult.SignedOut -> null
        }

        fun ConfigError.toMessage(): ExerciseLibraryMessage = when (this) {
            ConfigError.Offline -> ExerciseLibraryMessage.Offline
            ConfigError.ExerciseListFrozen -> ExerciseLibraryMessage.ListFrozen
            is ConfigError.ExerciseListFull -> ExerciseLibraryMessage.ListFull(maxItems)
            else -> ExerciseLibraryMessage.Failed
        }
    }
}
