package com.trackbit.feature.habitsconfig

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.HabitsRepository
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.GradientPresets
import com.trackbit.core.model.Habit
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitRequest
import com.trackbit.core.model.HabitRules
import com.trackbit.core.model.HabitType
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** The values the habit form edits. */
data class HabitForm(
    val name: String = "",
    val type: HabitType = HabitType.Count,
    val isAntiHabit: Boolean = false,
    val weeklyGoal: Int = 7,
    /** Minutes for [HabitType.Timed], times otherwise. */
    val dailyGoal: Int = 5,
    val icon: HabitIcon = HabitIcon.Star,
    val colorTheme: ColorTheme = ColorTheme.Green,
    /** The custom gradient, kept while a preset is picked so switching back restores it. */
    val colorStops: List<ColorStop> = GradientPresets.getValue(ColorTheme.Custom),
) {
    /** An anti-habit switch left on under a type that can't have it is off. */
    private val sentAntiHabit: Boolean get() = isAntiHabit && HabitRules.canBeAntiHabit(type)

    val problems: Set<HabitRules.Problem>
        get() = HabitRules.problems(name, type, sentAntiHabit, weeklyGoal, dailyGoal, colorStops)

    /** Null while [problems] isn't empty. */
    fun request(): HabitRequest? = if (problems.isNotEmpty()) null else
        HabitRequest(name.trim(), type, sentAntiHabit, weeklyGoal, dailyGoal, colorTheme, colorStops, icon)

    companion object {
        fun of(habit: Habit) = HabitForm(
            name = habit.name,
            type = habit.type.takeIf { it in HabitRules.FORM_TYPES } ?: HabitType.Count,
            isAntiHabit = habit.isAntiHabit,
            weeklyGoal = habit.weeklyGoal,
            dailyGoal = habit.dailyGoal,
            icon = habit.icon,
            colorTheme = habit.colorTheme.takeIf { it != ColorTheme.Unknown } ?: ColorTheme.Green,
            colorStops = habit.colorStops.ifEmpty { GradientPresets.getValue(ColorTheme.Custom) },
        )
    }
}

data class HabitFormUiState(
    /** Null for a new habit. */
    val habitId: Int? = null,
    /** Editing: the habit is still loading. */
    val loading: Boolean = false,
    /** Editing: the habit couldn't be loaded (offline, or deleted elsewhere). */
    val loadFailed: Boolean = false,
    val form: HabitForm = HabitForm(),
    /** Read-only: over the role's limits. It can still be deleted. */
    val frozen: Boolean = false,
    /** The role's types; null when every type is allowed (or limits haven't loaded). */
    val allowedTypes: List<HabitType>? = null,
    /** Problems show only after a first save attempt, as on the web. */
    val showProblems: Boolean = false,
    val busy: Boolean = false,
    val message: HabitFormMessage? = null,
    /** Saved or deleted: the screen closes. */
    val done: Boolean = false,
) {
    val isNew: Boolean get() = habitId == null
    val canSave: Boolean get() = !loading && !loadFailed && !frozen && !busy

    fun allows(type: HabitType) = allowedTypes == null || type in allowedTypes
}

sealed interface HabitFormMessage {
    data object Offline : HabitFormMessage
    data object Failed : HabitFormMessage
    data object HabitFrozen : HabitFormMessage
    data object NotFound : HabitFormMessage
    data class HabitLimitReached(val maxHabits: Int) : HabitFormMessage
    data class HabitTypeNotAllowed(val type: HabitType?, val allowed: List<HabitType>) : HabitFormMessage
}

/** Creates or edits one habit, like the web's habit drawer. The route's `habitId` is null for a new one. */
@HiltViewModel
class HabitFormViewModel @Inject constructor(
    private val repository: HabitsRepository,
    savedState: SavedStateHandle,
) : ViewModel() {
    private val habitId: Int? = savedState[HABIT_ID]

    private val _state = MutableStateFlow(HabitFormUiState(habitId = habitId, loading = habitId != null))
    val state: StateFlow<HabitFormUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        _state.update { it.copy(loading = habitId != null, loadFailed = false) }
        viewModelScope.launch {
            val limits = async { repository.limits() }
            if (habitId != null) {
                when (val habits = repository.habits()) {
                    is ConfigResult.Success -> {
                        val habit = habits.value.find { it.id == habitId }
                        _state.update {
                            if (habit == null) {
                                it.copy(loading = false, loadFailed = true, message = HabitFormMessage.NotFound)
                            } else {
                                it.copy(loading = false, form = HabitForm.of(habit), frozen = habit.frozen)
                            }
                        }
                    }
                    is ConfigResult.Failure -> _state.update {
                        it.copy(loading = false, loadFailed = true, message = habits.error.toMessage())
                    }
                }
            }
            val allowed = (limits.await() as? ConfigResult.Success)?.value?.effective?.allowedHabitTypes
            _state.update { it.copy(allowedTypes = allowed) }
        }
    }

    fun edit(change: (HabitForm) -> HabitForm) {
        _state.update { it.copy(form = change(it.form)) }
    }

    /** Switching type moves the daily goal into the new type's range. */
    fun setType(type: HabitType) = edit {
        it.copy(type = type, dailyGoal = it.dailyGoal.coerceIn(HabitRules.dailyGoalRange(type)))
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
            val result = if (habitId == null) repository.create(request) else repository.update(habitId, request)
            finish(result)
        }
    }

    fun delete() {
        val id = habitId ?: return
        if (_state.value.busy) return
        _state.update { it.copy(busy = true) }
        viewModelScope.launch { finish(repository.delete(id)) }
    }

    fun onMessageShown(message: HabitFormMessage) {
        _state.update { if (it.message == message) it.copy(message = null) else it }
    }

    private fun finish(result: ConfigResult<*>) = _state.update {
        when (result) {
            is ConfigResult.Success -> it.copy(busy = false, done = true)
            is ConfigResult.Failure -> it.copy(busy = false, message = result.error.toMessage())
        }
    }

    companion object {
        /** The route's argument (`HabitFormRoute.habitId`). */
        const val HABIT_ID = "habitId"

        private fun ConfigError.toMessage(): HabitFormMessage = when (this) {
            ConfigError.Offline -> HabitFormMessage.Offline
            ConfigError.HabitFrozen -> HabitFormMessage.HabitFrozen
            ConfigError.NotFound -> HabitFormMessage.NotFound
            is ConfigError.HabitLimitReached -> HabitFormMessage.HabitLimitReached(maxHabits)
            is ConfigError.HabitTypeNotAllowed -> HabitFormMessage.HabitTypeNotAllowed(type, allowed)
            else -> HabitFormMessage.Failed
        }
    }
}
