package com.trackbit.feature.tracker

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.data.SyncResult
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.data.WriteResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import javax.inject.Inject

data class TodayUiState(
    /** Null until Room has answered for the current day. */
    val day: LocalDate? = null,
    val habits: List<TrackedHabit>? = null,
    val pendingWrites: Int = 0,
    val refreshing: Boolean = false,
    val message: TodayMessage? = null,
)

enum class TodayMessage { Offline, SyncFailed, HabitFrozen }

@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel
class TodayViewModel @Inject constructor(
    private val tracker: TrackerRepository,
    clock: DayClock,
) : ViewModel() {
    private val refreshing = MutableStateFlow(false)
    private val message = MutableStateFlow<TodayMessage?>(null)

    // Day and habits travel together, so rows never show one day's logs under another's date.
    private val shown = clock.today.flatMapLatest { day ->
        tracker.observeDay(day).map { day to it }
    }

    val state: StateFlow<TodayUiState> = combine(
        shown.map<_, Pair<LocalDate, List<TrackedHabit>>?> { it }.onStart { emit(null) },
        tracker.pendingWrites.onStart { emit(0) },
        refreshing,
        message,
    ) { shown, pending, refreshing, message ->
        TodayUiState(shown?.first, shown?.second, pending, refreshing, message)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), TodayUiState())

    init {
        // Nothing else pulls right after sign-in; the periodic sync can take 15 minutes.
        refresh()
    }

    fun refresh() {
        if (!refreshing.compareAndSet(expect = false, update = true)) return
        viewModelScope.launch {
            try {
                when (tracker.refresh()) {
                    SyncResult.Done, SyncResult.SignedOut -> Unit
                    SyncResult.Retry -> message.value = TodayMessage.Offline
                    SyncResult.Failed -> message.value = TodayMessage.SyncFailed
                }
            } finally {
                refreshing.value = false
            }
        }
    }

    /** Writes go to the day the row shows, which is the day the user is looking at. */
    fun increment(habit: TrackedHabit) = write { tracker.increment(habit.id, habit.day, 1) }

    fun toggle(habit: TrackedHabit) = write { tracker.toggle(habit.id, habit.day) }

    /** Clears [shown] unless a newer message has replaced it. */
    fun onMessageShown(shown: TodayMessage) {
        message.compareAndSet(shown, null)
    }

    private fun write(block: suspend () -> WriteResult) {
        viewModelScope.launch {
            when (block()) {
                WriteResult.HabitFrozen -> message.value = TodayMessage.HabitFrozen
                // A missing habit was deleted by a sync; its row is already gone.
                WriteResult.Queued, WriteResult.HabitNotFound, WriteResult.NoChange -> Unit
            }
        }
    }
}
