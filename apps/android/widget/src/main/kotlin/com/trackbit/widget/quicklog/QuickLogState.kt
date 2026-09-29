package com.trackbit.widget.quicklog

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

internal sealed interface QuickLogState {
    data object SignedOut : QuickLogState

    /** No habit chosen yet: the configuration activity didn't finish. */
    data object Unconfigured : QuickLogState

    /** The chosen habit isn't in Room: deleted, or it belonged to another account. */
    data object HabitRemoved : QuickLogState

    data class Tracking(val habit: TrackedHabit) : QuickLogState
}

/**
 * What one W1 instance shows, for its chosen [habitId] (null until configured). The id is a flow
 * because reconfiguring changes it while a Glance session is running.
 *
 * Nothing about the choice is cleared on sign-out or deletion: the state is derived each time, so
 * a habit that comes back (the same account signing in again) shows up again by itself.
 */
@OptIn(ExperimentalCoroutinesApi::class)
internal fun quickLogState(
    auth: Flow<AuthState>,
    day: Flow<LocalDate>,
    tracker: TrackerRepository,
    habitId: Flow<Int?>,
): Flow<QuickLogState> = auth
    .filterNot { it is AuthState.Loading }
    .map { it is AuthState.SignedIn }
    .distinctUntilChanged()
    .flatMapLatest { signedIn ->
        if (!signedIn) return@flatMapLatest flowOf(QuickLogState.SignedOut)
        habitId.distinctUntilChanged().flatMapLatest { id ->
            if (id == null) {
                flowOf(QuickLogState.Unconfigured)
            } else {
                day.flatMapLatest { d ->
                    tracker.observeHabit(id, d).map { habit ->
                        habit?.let(QuickLogState::Tracking) ?: QuickLogState.HabitRemoved
                    }
                }
            }
        }
    }
