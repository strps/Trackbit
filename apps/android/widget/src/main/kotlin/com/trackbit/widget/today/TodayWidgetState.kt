package com.trackbit.widget.today

import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNot
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import java.time.LocalDate

internal sealed interface TodayWidgetState {
    data object SignedOut : TodayWidgetState

    /** Every habit on [day], in display order; empty when the user has none. */
    data class Tracking(val day: LocalDate, val habits: List<TrackedHabit>) : TodayWidgetState
}

/** Day and habits travel together, so rows never show one day's logs under another's date. */
@OptIn(ExperimentalCoroutinesApi::class)
internal fun todayWidgetState(
    auth: Flow<AuthState>,
    day: Flow<LocalDate>,
    tracker: TrackerRepository,
): Flow<TodayWidgetState> = auth
    .filterNot { it is AuthState.Loading }
    .map { it is AuthState.SignedIn }
    .distinctUntilChanged()
    .flatMapLatest { signedIn ->
        if (signedIn) {
            day.flatMapLatest { d -> tracker.observeDay(d).map { TodayWidgetState.Tracking(d, it) } }
        } else {
            flowOf(TodayWidgetState.SignedOut)
        }
    }
