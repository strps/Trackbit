package com.trackbit.feature.analytics

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.AnalyticsRepository
import com.trackbit.core.data.DayClock
import com.trackbit.core.data.SessionRepository
import com.trackbit.core.data.SyncResult
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.HabitSet
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.HistoryOwner
import com.trackbit.core.model.UnitSystem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import javax.inject.Inject

data class AnalyticsUiState(
    /** Null until the clock and Room have answered. */
    val today: LocalDate? = null,
    /** Every habit, in display order: the picker's options. */
    val habits: List<TrackedHabit>? = null,
    /** The picked habit on [today], its days reaching back to its first log and over the heatmap's year. */
    val habit: TrackedHabit? = null,
    /** Null until Room holds every log of [habit]: partial history would understate them. */
    val stats: HabitStats? = null,
    /** A workout habit's sets; null until first pulled (or for other habits). */
    val sets: List<HabitSet>? = null,
    val exercises: List<Exercise> = emptyList(),
    val unitSystem: UnitSystem = UnitSystem.Metric,
    val refreshing: Boolean = false,
    val message: AnalyticsMessage? = null,
)

enum class AnalyticsMessage { Offline, SyncFailed }

/**
 * The web's Stats page for one habit at a time: stat cards, a year's heatmap, and for workout
 * habits the exercise, volume and muscle charts. Chart controls are screen state, like the web's.
 *
 * Stats need every log: while the screen lives it asks for history back to the earliest first
 * log of any habit (switching habits then needs no new pull), released by the next screen's init.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class AnalyticsViewModel @Inject constructor(
    private val tracker: TrackerRepository,
    private val analytics: AnalyticsRepository,
    sessions: SessionRepository,
    auth: AuthRepository,
    clock: DayClock,
    private val savedState: SavedStateHandle,
) : ViewModel() {
    private val refreshing = MutableStateFlow(false)
    private val message = MutableStateFlow<AnalyticsMessage?>(null)
    private val historyLock = Mutex()

    private val today: Flow<LocalDate> = clock.today

    private val habits: Flow<Pair<LocalDate, List<TrackedHabit>>> =
        today.flatMapLatest { today -> tracker.observeDay(today, 1).map { today to it } }

    private val pickedId: Flow<Int?> = savedState.getStateFlow<Int?>(HABIT_ID, null)

    /** The picked habit's id, or the first habit's; null without habits. */
    private val habitId: Flow<Int?> = combine(habits, pickedId) { (_, habits), picked ->
        habits.find { it.id == picked }?.id ?: habits.firstOrNull()?.id
    }.distinctUntilChanged()

    private val habit: Flow<TrackedHabit?> = combine(habits, habitId) { (today, habits), id ->
        habits.find { it.id == id }?.let { Triple(today, it.id, it.firstLogDay) }
    }.distinctUntilChanged().flatMapLatest { picked ->
        if (picked == null) {
            flowOf(null)
        } else {
            val (today, id, firstLogDay) = picked
            tracker.observeHabit(id, today, daysBack(today, firstLogDay))
        }
    }

    private val sets: Flow<List<HabitSet>?> = combine(habits, habitId) { (_, habits), id ->
        habits.find { it.id == id }?.takeIf { it.type == HabitType.Complex }?.id
    }.distinctUntilChanged().flatMapLatest { id -> if (id == null) flowOf(null) else analytics.observeSets(id) }

    private val unitSystem: Flow<UnitSystem> = auth.state.map { state ->
        (state as? AuthState.SignedIn)?.user?.unitSystem?.takeIf { it != UnitSystem.Unknown } ?: UnitSystem.Metric
    }.distinctUntilChanged()

    private val data = combine(habits, habit, sets, sessions.observeExercises(), unitSystem) { (today, habits), habit, sets, exercises, units ->
        AnalyticsUiState(
            today = today,
            habits = habits,
            habit = habit,
            stats = habit?.takeIf { it.allLogsKnown }?.let { habitStats(it.recent, it.streak, today) },
            sets = sets,
            exercises = exercises,
            unitSystem = units,
        )
    }

    val state: StateFlow<AnalyticsUiState> = combine(
        data.map<_, AnalyticsUiState?> { it }.onStart { emit(null) },
        refreshing,
        message,
    ) { data, refreshing, message ->
        (data ?: AnalyticsUiState()).copy(refreshing = refreshing, message = message)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), AnalyticsUiState())

    init {
        viewModelScope.launch {
            // A request left by an earlier screen goes first; then follow the habits' first logs.
            historyLock.withLock { tracker.releaseHistory(HistoryOwner.Analytics) }
            habits.map { (today, habits) -> historyStart(today, habits) }.distinctUntilChanged().collect { start ->
                historyLock.withLock { tracker.requestHistory(HistoryOwner.Analytics, start) }
            }
        }
        // A workout habit's sets are pulled when it is picked (and on pull-to-refresh).
        viewModelScope.launch {
            combine(habits, habitId) { (_, habits), id -> habits.find { it.id == id }?.takeIf { it.type == HabitType.Complex }?.id }
                .distinctUntilChanged()
                .filterNotNull()
                .collect { id -> report(analytics.refresh(id)) }
        }
    }

    fun selectHabit(id: Int) {
        savedState[HABIT_ID] = id
    }

    fun refresh() {
        if (!refreshing.compareAndSet(expect = false, update = true)) return
        viewModelScope.launch {
            try {
                var result = tracker.refresh()
                val workout = state.value.habit?.takeIf { it.type == HabitType.Complex }
                if (workout != null && result != SyncResult.SignedOut) result = maxOf(result, analytics.refresh(workout.id))
                report(result)
            } finally {
                refreshing.value = false
            }
        }
    }

    /** Clears [shown] unless a newer message has replaced it. */
    fun onMessageShown(shown: AnalyticsMessage) {
        message.compareAndSet(shown, null)
    }

    private fun report(result: SyncResult) {
        when (result) {
            SyncResult.Done, SyncResult.SignedOut -> Unit
            SyncResult.Retry -> message.value = AnalyticsMessage.Offline
            SyncResult.Failed -> message.value = AnalyticsMessage.SyncFailed
        }
    }

    internal companion object {
        const val HABIT_ID = "habitId"

        /** The heatmap's span: 53 calendar weeks always cover a year ending in any weekday. */
        const val HEATMAP_DAYS = 53 * 7

        /** The first day the screen needs: the heatmap's, or an earlier first log. */
        fun historyStart(today: LocalDate, habits: List<TrackedHabit>): LocalDate =
            (habits.mapNotNull { it.firstLogDay } + today.minusDays(HEATMAP_DAYS - 1L)).min()

        /** How many days ending at [today] to read for a habit first logged on [firstLogDay]. */
        fun daysBack(today: LocalDate, firstLogDay: LocalDate?): Int {
            val first = listOfNotNull(firstLogDay, today.minusDays(HEATMAP_DAYS - 1L)).min()
            return ChronoUnit.DAYS.between(first, today).toInt() + 1
        }
    }
}
