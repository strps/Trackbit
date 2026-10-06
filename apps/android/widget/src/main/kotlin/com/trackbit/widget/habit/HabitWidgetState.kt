package com.trackbit.widget.habit

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.state.getAppWidgetState
import androidx.glance.appwidget.state.updateAppWidgetState
import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.TrackedHabit
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNot
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map
import java.time.LocalDate

/**
 * A widget that shows one habit the user chose in [HabitPickerActivity] (W1, W3). The choice is
 * kept in the instance's Glance state (the default Preferences definition), and it is all that
 * is stored: everything shown comes from Room.
 */
internal val HabitUuidKey = stringPreferencesKey("habitUuid")

/**
 * The habit widget [id] shows, or null until one is chosen. A widget placed before habits had
 * uuids (Room version 9) holds only an int key, which nothing reads: it asks for its habit again.
 */
internal suspend fun GlanceAppWidget.chosenHabitUuid(context: Context, id: GlanceId): String? =
    getAppWidgetState<Preferences>(context, id)[HabitUuidKey]

/** Points the habit widget [id] at [habitUuid] and re-renders it. */
internal suspend fun GlanceAppWidget.chooseHabit(context: Context, id: GlanceId, habitUuid: String) {
    updateAppWidgetState(context, id) { it[HabitUuidKey] = habitUuid }
    update(context, id)
}

internal sealed interface HabitWidgetState {
    data object SignedOut : HabitWidgetState

    /** No habit chosen yet: the picker didn't finish. */
    data object Unconfigured : HabitWidgetState

    /** The chosen habit isn't in Room: deleted, or it belonged to another account. */
    data object HabitRemoved : HabitWidgetState

    data class Tracking(val habit: TrackedHabit) : HabitWidgetState
}

/**
 * What one habit widget shows, for its chosen [habitUuid] (null until configured), as [observe]
 * reads it on each day. The uuid is a flow because reconfiguring changes it while a Glance session
 * is running.
 *
 * Nothing about the choice is cleared on sign-out or deletion: the state is derived each time, so
 * a habit that comes back (the same account signing in again) shows up again by itself.
 */
@OptIn(ExperimentalCoroutinesApi::class)
internal fun habitWidgetState(
    auth: Flow<AuthState>,
    day: Flow<LocalDate>,
    habitUuid: Flow<String?>,
    observe: (habitUuid: String, day: LocalDate) -> Flow<TrackedHabit?>,
): Flow<HabitWidgetState> = auth
    .filterNot { it is AuthState.Loading }
    .map { it is AuthState.SignedIn }
    .distinctUntilChanged()
    .flatMapLatest { signedIn ->
        if (!signedIn) return@flatMapLatest flowOf(HabitWidgetState.SignedOut)
        habitUuid.distinctUntilChanged().flatMapLatest { uuid ->
            if (uuid == null) {
                flowOf(HabitWidgetState.Unconfigured)
            } else {
                day.flatMapLatest { d ->
                    observe(uuid, d).map { habit ->
                        habit?.let(HabitWidgetState::Tracking) ?: HabitWidgetState.HabitRemoved
                    }
                }
            }
        }
    }
