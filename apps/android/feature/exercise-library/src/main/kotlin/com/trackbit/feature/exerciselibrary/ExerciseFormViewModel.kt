package com.trackbit.feature.exerciselibrary

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.ExerciseLibraryRepository
import com.trackbit.core.data.SyncResult
import com.trackbit.core.data.newUuid
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseRequest
import com.trackbit.core.model.ExerciseRules
import com.trackbit.core.model.MuscleGroup
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** The values the custom exercise form edits. */
data class ExerciseForm(
    val name: String = "",
    val description: String = "",
    val category: ExerciseCategory = ExerciseCategory.Strength,
    val muscleGroups: Set<Int> = emptySet(),
) {
    val problems: Set<ExerciseRules.Problem> get() = ExerciseRules.problems(name, description, category)

    /** Null while [problems] isn't empty. A blank description clears it. */
    fun request(): ExerciseRequest? = if (problems.isNotEmpty()) null else
        ExerciseRequest(name.trim(), description.trim().ifEmpty { null }, category, muscleGroups.sorted())

    companion object {
        fun of(exercise: Exercise) = ExerciseForm(
            name = exercise.name,
            description = exercise.description.orEmpty(),
            category = ExerciseCategory.of(exercise.category).takeIf { it in ExerciseCategory.FORM } ?: ExerciseCategory.Strength,
            muscleGroups = exercise.muscleGroups.map { it.id }.toSet(),
        )
    }
}

data class ExerciseFormUiState(
    /** Null for a new exercise. */
    val exerciseUuid: String? = null,
    val loading: Boolean = true,
    /** Never pulled and offline, or (editing) the exercise is gone or isn't the user's. */
    val loadFailed: Boolean = false,
    val form: ExerciseForm = ExerciseForm(),
    /** The taxonomy the muscle chips offer, in its order. */
    val muscleGroups: List<MuscleGroup> = emptyList(),
    /** Read-only: over the role's limits. It can still be deleted. */
    val frozen: Boolean = false,
    /** Editing: the user logged it, so deleting it also takes those sets (the dialog says so). */
    val logged: Boolean = false,
    /** Problems show only after a first save attempt, as on the web. */
    val showProblems: Boolean = false,
    /** The server refused the name as a duplicate; cleared when the name changes. */
    val nameTaken: Boolean = false,
    val busy: Boolean = false,
    val message: ExerciseFormMessage? = null,
    /** Saved or deleted: the screen closes. */
    val done: Boolean = false,
) {
    val isNew: Boolean get() = exerciseUuid == null
    val canSave: Boolean get() = !loading && !loadFailed && !frozen && !busy
}

sealed interface ExerciseFormMessage {
    data object Offline : ExerciseFormMessage
    data object Failed : ExerciseFormMessage
    data object Frozen : ExerciseFormMessage
    data object NotFound : ExerciseFormMessage
    data class LimitReached(val maxCustomExercises: Int) : ExerciseFormMessage
}

/**
 * Creates a custom exercise or edits one of the user's own, like the web's exercise dialog.
 * The route's `exerciseUuid` is null for a new one. System exercises aren't editable. It starts
 * from Room's copy, taken once so a pull meanwhile can't undo the user's changes.
 */
@HiltViewModel
class ExerciseFormViewModel @Inject constructor(
    private val repository: ExerciseLibraryRepository,
    savedState: SavedStateHandle,
) : ViewModel() {
    private val exerciseUuid: String? = savedState[EXERCISE_UUID]

    /** A new exercise's uuid, kept across process death so a retried save can't create it twice. */
    private val newExerciseUuid: String by lazy { savedState[NEW_UUID] ?: newUuid().also { savedState[NEW_UUID] = it } }

    private val _state = MutableStateFlow(ExerciseFormUiState(exerciseUuid = exerciseUuid))
    val state: StateFlow<ExerciseFormUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = true, loadFailed = false) }
        viewModelScope.launch {
            // Room holds both once pulled; only a first open pulls them here.
            var groups = repository.muscleGroups().first()
            var exercises = repository.exercises().first()
            if (groups == null || (exerciseUuid != null && exercises == null)) {
                val result = repository.refresh()
                groups = repository.muscleGroups().first()
                exercises = repository.exercises().first()
                if (groups == null || (exerciseUuid != null && exercises == null)) return@launch fail(result.toLoadMessage())
            }
            val exercise: Exercise? = if (exerciseUuid == null) null else {
                exercises?.find { it.uuid == exerciseUuid && it.userId != null } ?: return@launch fail(ExerciseFormMessage.NotFound)
            }
            _state.update { state ->
                state.copy(
                    loading = false,
                    muscleGroups = groups.sortedWith(GROUP_ORDER),
                    form = exercise?.let(ExerciseForm::of) ?: state.form,
                    frozen = exercise?.frozen ?: false,
                    logged = exercise?.lastPerformance != null,
                )
            }
        }
    }

    fun edit(change: (ExerciseForm) -> ExerciseForm) {
        _state.update { state ->
            val form = change(state.form)
            state.copy(form = form, nameTaken = state.nameTaken && form.name == state.form.name)
        }
    }

    fun toggleMuscleGroup(id: Int) = edit { form ->
        form.copy(muscleGroups = if (id in form.muscleGroups) form.muscleGroups - id else form.muscleGroups + id)
    }

    fun save() {
        val state = _state.value
        if (!state.canSave) return
        val request = state.form.request()
        if (request == null) {
            _state.update { it.copy(showProblems = true) }
            return
        }
        _state.update { it.copy(busy = true, showProblems = true) }
        viewModelScope.launch {
            val result = if (exerciseUuid == null) {
                repository.create(request.copy(uuid = newExerciseUuid))
            } else {
                repository.update(exerciseUuid, request)
            }
            finish(result)
        }
    }

    fun delete() {
        val uuid = exerciseUuid ?: return
        if (_state.value.busy) return
        _state.update { it.copy(busy = true) }
        viewModelScope.launch { finish(repository.delete(uuid)) }
    }

    fun onMessageShown(message: ExerciseFormMessage) {
        _state.update { if (it.message == message) it.copy(message = null) else it }
    }

    private fun fail(message: ExerciseFormMessage) = _state.update { it.copy(loading = false, loadFailed = true, message = message) }

    private fun finish(result: ConfigResult<*>) = _state.update {
        when (result) {
            is ConfigResult.Success -> it.copy(busy = false, done = true)
            is ConfigResult.Failure -> when (result.error) {
                // Shown under the name field, as the web does.
                ConfigError.ExerciseNameTaken -> it.copy(busy = false, nameTaken = true)
                else -> it.copy(
                    busy = false,
                    // Frozen meanwhile (the role changed): the form turns read-only.
                    frozen = it.frozen || result.error == ConfigError.CustomExerciseFrozen,
                    message = result.error.toMessage(),
                )
            }
        }
    }

    companion object {
        /** The route's argument (`ExerciseFormRoute.exerciseUuid`). */
        const val EXERCISE_UUID = "exerciseUuid"

        private const val NEW_UUID = "newExerciseUuid"

        /** Why a pull that left Room without what the form needs failed. */
        private fun SyncResult.toLoadMessage(): ExerciseFormMessage =
            if (this == SyncResult.Retry) ExerciseFormMessage.Offline else ExerciseFormMessage.Failed

        private fun ConfigError.toMessage(): ExerciseFormMessage = when (this) {
            ConfigError.Offline -> ExerciseFormMessage.Offline
            ConfigError.CustomExerciseFrozen -> ExerciseFormMessage.Frozen
            ConfigError.NotFound -> ExerciseFormMessage.NotFound
            is ConfigError.CustomExerciseLimitReached -> ExerciseFormMessage.LimitReached(maxCustomExercises)
            else -> ExerciseFormMessage.Failed
        }
    }
}
