package com.trackbit.feature.tracker

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.data.DayClock
import com.trackbit.core.data.RECENT_DAYS
import com.trackbit.core.data.STREAK_DAYS
import com.trackbit.core.data.SyncResult
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.data.WriteResult
import com.trackbit.core.model.HistoryOwner
import dagger.hilt.android.lifecycle.HiltViewModel
import java.time.LocalDate
import javax.inject.Inject
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

data class TrackerUiState(
    /** Null until the clock and Room have answered. */
    val today: LocalDate? = null,
    /** The day shown: today, or a past day the user picked. */
    val day: LocalDate? = null,
    val habits: List<TrackedHabit>? = null,
    val pendingWrites: Int = 0,
    val refreshing: Boolean = false,
    val message: TrackerMessage? = null,
) {
    val isToday: Boolean get() = day != null && day == today
}

enum class TrackerMessage { Offline, SyncFailed, HabitFrozen }

/** The days a screen deals with: [day] is never after [today]. */
private data class ShownDays(val today: LocalDate, val day: LocalDate) {
    val isToday: Boolean get() = day == today
}

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class TrackerViewModel @Inject constructor(
    private val tracker: TrackerRepository,
    clock: DayClock,
    private val savedState: SavedStateHandle,
) : ViewModel() {
    private val refreshing = MutableStateFlow(false)
    private val message = MutableStateFlow<TrackerMessage?>(null)

    /** The past day the user picked, or null to follow today (also across midnight). */
    private val picked: Flow<LocalDate?> = savedState.getStateFlow<String?>(PICKED_DAY, null).map { it?.let(LocalDate::parse) }

    private val days: Flow<ShownDays> = combine(clock.today, picked) { today, picked ->
        ShownDays(today, picked?.takeIf { it.isBefore(today) } ?: today)
    }.distinctUntilChanged()

    /** Orders history requests and releases (fair, so first come, first served) off the display path. */
    private val historyLock = Mutex()
    private var historyRequested = false

    // Days and habits travel together, so rows never show one day's logs under another's date.
    // A past day reads enough days to walk its streak back.
    private val shown = days.onEach(::followWithHistory).flatMapLatest { days ->
        tracker.observeDay(days.day, if (days.isToday) RECENT_DAYS else STREAK_DAYS).map { days to it }
    }

    val state: StateFlow<TrackerUiState> = combine(
        shown.map<_, Pair<ShownDays, List<TrackedHabit>>?> { it }.onStart { emit(null) },
        tracker.pendingWrites.onStart { emit(0) },
        refreshing,
        message,
    ) { shown, pending, refreshing, message ->
        TrackerUiState(shown?.first?.today, shown?.first?.day, shown?.second, pending, refreshing, message)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TrackerUiState())

    init {
        // A request left by an earlier screen (the app closed on a past day) goes first.
        viewModelScope.launch { historyLock.withLock { tracker.releaseHistory(HistoryOwner.Tracker) } }
        // Nothing else pulls right after sign-in; the periodic sync can take 15 minutes.
        refresh()
    }

    /**
     * Past days need history: their logs, and a year before them for the streak. The request
     * follows the shown day while the screen is visible, and goes when it's today again.
     */
    private fun followWithHistory(days: ShownDays) {
        viewModelScope.launch {
            historyLock.withLock {
                if (!days.isToday) {
                    tracker.requestHistory(HistoryOwner.Tracker, days.day.minusDays(STREAK_DAYS - 1L))
                    historyRequested = true
                } else if (historyRequested) {
                    tracker.releaseHistory(HistoryOwner.Tracker)
                    historyRequested = false
                }
            }
        }
    }

    /** Shows [day]; today or later follows today again. */
    fun selectDay(day: LocalDate) {
        val today = state.value.today ?: return
        savedState[PICKED_DAY] = day.takeIf { it.isBefore(today) }?.toString()
    }

    /** Moves the shown day by [offset] days, never past today. */
    fun moveDay(offset: Long) {
        state.value.day?.let { selectDay(it.plusDays(offset)) }
    }

    fun refresh() {
        if (!refreshing.compareAndSet(expect = false, update = true)) return
        viewModelScope.launch {
            try {
                when (tracker.refresh()) {
                    SyncResult.Done, SyncResult.SignedOut -> Unit
                    SyncResult.Retry -> message.value = TrackerMessage.Offline
                    SyncResult.Failed -> message.value = TrackerMessage.SyncFailed
                }
            } finally {
                refreshing.value = false
            }
        }
    }

    // Writes go to the day the row shows, which is the day the user is looking at.

    /** Adds [delta] (+1 or -1); never takes the count below 0. */
    fun increment(habit: TrackedHabit, delta: Int = 1) {
        if (delta < 0 && habit.progress.value + delta < 0) return
        write { tracker.increment(habit.uuid, habit.day, delta) }
    }

    fun toggle(habit: TrackedHabit) = write { tracker.toggle(habit.uuid, habit.day) }

    /** Timed habits: starts a timer for the shown day, or stops the running one. */
    fun toggleTimer(habit: TrackedHabit) = write {
        if (habit.timer != null) tracker.stopTimer(habit.uuid) else tracker.startTimer(habit.uuid, habit.day)
    }

    /** Timed habits: sets the day's total to [ms]. */
    fun setTime(habit: TrackedHabit, ms: Long) {
        require(ms in 0..Int.MAX_VALUE) { "ms out of range" }
        write { tracker.setRating(habit.uuid, habit.day, ms.toInt()) }
    }

    /** Clears [shown] unless a newer message has replaced it. */
    fun onMessageShown(shown: TrackerMessage) {
        message.compareAndSet(shown, null)
    }

    private fun write(block: suspend () -> WriteResult) {
        viewModelScope.launch {
            when (block()) {
                WriteResult.HabitFrozen -> message.value = TrackerMessage.HabitFrozen
                // A missing habit was deleted by a sync; its row is already gone.
                WriteResult.Queued, WriteResult.HabitNotFound, WriteResult.NoChange, WriteResult.ExerciseFrozen -> Unit
            }
        }
    }

    private companion object {
        const val PICKED_DAY = "pickedDay"
    }
}
