package com.trackbit.feature.habitsconfig

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.HabitsRepository
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.Habit
import com.trackbit.core.model.HabitOrder
import com.trackbit.core.model.HabitRules
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * One line of the reorderable list. The anti-habits header is a row too, so dragging a habit
 * past it moves the habit into the other group, as dropping it in the web's other box does.
 */
sealed interface HabitsConfigRow {
    val key: Any

    data class Item(val habit: Habit) : HabitsConfigRow {
        override val key: Any get() = habit.id
    }

    data object AntiHeader : HabitsConfigRow {
        override val key: Any get() = ANTI_HEADER_KEY
    }
}

internal const val ANTI_HEADER_KEY = "anti-habits"

data class HabitsConfigUiState(
    /** Habits, then [HabitsConfigRow.AntiHeader], then anti-habits. Null until the first load. */
    val rows: List<HabitsConfigRow>? = null,
    /** The first load failed: show a retry instead of a list. */
    val loadFailed: Boolean = false,
    /** Null when nothing is capped, or until the limits load. */
    val limits: EffectiveLimits? = null,
    val refreshing: Boolean = false,
    val message: HabitsConfigMessage? = null,
) {
    val habits: List<Habit> get() = rows.orEmpty().mapNotNull { (it as? HabitsConfigRow.Item)?.habit }

    val atHabitCap: Boolean get() = limits?.maxHabits?.let { habits.size >= it } ?: false
}

sealed interface HabitsConfigMessage {
    data object Offline : HabitsConfigMessage
    data object Failed : HabitsConfigMessage
    data object HabitFrozen : HabitsConfigMessage
    data object StructuredAntiHabit : HabitsConfigMessage
    data class HabitLimitReached(val maxHabits: Int) : HabitsConfigMessage
}

/**
 * The habits config list, like the web's `/config/habits`: both groups in order, reordered by
 * dragging (also across groups). It reads the server, not Room: config needs a connection, and
 * only `GET /api/habits` has each habit's own stops. The screen reloads on resume, which also
 * picks up the form's saves.
 */
@HiltViewModel
class HabitsConfigViewModel @Inject constructor(
    private val repository: HabitsRepository,
) : ViewModel() {
    private val _state = MutableStateFlow(HabitsConfigUiState())
    val state: StateFlow<HabitsConfigUiState> = _state.asStateFlow()

    /** The order the server has; a failed reorder returns to it. */
    private var saved: List<HabitsConfigRow> = emptyList()
    private var dragging = false

    fun refresh() {
        if (_state.value.refreshing) return
        _state.update { it.copy(refreshing = true) }
        viewModelScope.launch {
            val limits = async { repository.limits() }
            when (val habits = repository.habits()) {
                is ConfigResult.Success -> {
                    saved = rowsOf(habits.value)
                    // A drag in progress keeps its own order; the drop reconciles with [saved].
                    _state.update { it.copy(rows = if (dragging) it.rows else saved, loadFailed = false) }
                }
                is ConfigResult.Failure -> _state.update {
                    it.copy(loadFailed = it.rows == null, message = habits.error.toMessage())
                }
            }
            val effective = (limits.await() as? ConfigResult.Success)?.value?.effective
            _state.update { it.copy(limits = effective ?: it.limits, refreshing = false) }
        }
    }

    /** A drag passed [to]: the dragged row ([from]) takes its place. */
    fun move(from: Any, to: Any) {
        dragging = true
        _state.update { state ->
            val rows = state.rows?.toMutableList() ?: return@update state
            val fromIndex = rows.indexOfFirst { it.key == from }
            val toIndex = rows.indexOfFirst { it.key == to }
            if (fromIndex < 0 || toIndex < 0) return@update state
            rows.add(toIndex, rows.removeAt(fromIndex))
            state.copy(rows = rows)
        }
    }

    /** The drag ended: sends the new order, or puts the old one back if it can't be. */
    fun drop() {
        dragging = false
        val rows = _state.value.rows ?: return
        val order = orderOf(rows)
        if (order == orderOf(saved)) return
        val byId = rows.mapNotNull { (it as? HabitsConfigRow.Item)?.habit }.associateBy { it.id }
        if (order.any { it.isAntiHabit && !HabitRules.canBeAntiHabit(byId.getValue(it.id).type) }) {
            _state.update { it.copy(rows = saved, message = HabitsConfigMessage.StructuredAntiHabit) }
            return
        }
        // A frozen habit may shift inside its group but not leave it (the server refuses).
        if (order.any { byId.getValue(it.id).frozen && it.isAntiHabit != byId.getValue(it.id).isAntiHabit }) {
            _state.update { it.copy(rows = saved, message = HabitsConfigMessage.HabitFrozen) }
            return
        }
        val reordered = rowsOf(order.map { byId.getValue(it.id).copy(order = it.order, isAntiHabit = it.isAntiHabit) })
        _state.update { it.copy(rows = reordered) }
        viewModelScope.launch {
            when (val result = repository.reorder(order)) {
                is ConfigResult.Success -> saved = reordered
                is ConfigResult.Failure -> _state.update { it.copy(rows = saved, message = result.error.toMessage()) }
            }
        }
    }

    /** The add button while at the cap: say why it does nothing. */
    fun onAddAtCap() {
        val max = _state.value.limits?.maxHabits ?: return
        _state.update { it.copy(message = HabitsConfigMessage.HabitLimitReached(max)) }
    }

    fun onMessageShown(message: HabitsConfigMessage) {
        _state.update { if (it.message == message) it.copy(message = null) else it }
    }

    private companion object {
        fun rowsOf(habits: List<Habit>): List<HabitsConfigRow> {
            val (anti, regular) = habits.partition { it.isAntiHabit }
            return regular.sortedBy { it.order }.map(HabitsConfigRow::Item) +
                HabitsConfigRow.AntiHeader +
                anti.sortedBy { it.order }.map(HabitsConfigRow::Item)
        }

        /** Each habit's group and place as [rows] show them: above the header is habits, below is anti-habits. */
        fun orderOf(rows: List<HabitsConfigRow>): List<HabitOrder> {
            val header = rows.indexOf(HabitsConfigRow.AntiHeader)
            val regular = rows.subList(0, header).filterIsInstance<HabitsConfigRow.Item>()
            val anti = rows.subList(header + 1, rows.size).filterIsInstance<HabitsConfigRow.Item>()
            return regular.mapIndexed { i, row -> HabitOrder(row.habit.id, i, isAntiHabit = false) } +
                anti.mapIndexed { i, row -> HabitOrder(row.habit.id, i, isAntiHabit = true) }
        }

        fun ConfigError.toMessage(): HabitsConfigMessage = when (this) {
            ConfigError.Offline -> HabitsConfigMessage.Offline
            ConfigError.HabitFrozen -> HabitsConfigMessage.HabitFrozen
            is ConfigError.HabitLimitReached -> HabitsConfigMessage.HabitLimitReached(maxHabits)
            else -> HabitsConfigMessage.Failed
        }
    }
}
