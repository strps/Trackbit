package com.trackbit.feature.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.SessionRepository
import com.trackbit.core.data.SyncResult
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackedSession
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.data.WriteResult
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.SetValues
import com.trackbit.core.model.UnitSystem
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.onStart
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate

data class SessionUiState(
    val day: LocalDate,
    /** Null until Room answers, or if the habit is gone. */
    val habit: TrackedHabit? = null,
    /** Null until Room answers. */
    val sessions: List<TrackedSession>? = null,
    /** The catalog, by name: what the picker offers and what names a log's exercise. */
    val exercises: List<Exercise> = emptyList(),
    val unitSystem: UnitSystem = UnitSystem.Metric,
    val cardStyle: ExerciseLogCardStyle = ExerciseLogCardStyle.Classic,
    val refreshing: Boolean = false,
    val message: SessionMessage? = null,
) {
    private val exercisesById: Map<Int, Exercise> = exercises.associateBy { it.id }

    fun exercise(id: Int): Exercise? = exercisesById[id]

    /** A frozen habit's session is shown read-only, like its tracker row. */
    val readOnly: Boolean get() = habit?.frozen == true
}

enum class SessionMessage { Offline, SyncFailed, HabitFrozen, ExerciseFrozen }

/**
 * A workout habit's sessions on one day, like the web's activity tracker. Reads come from Room;
 * every write goes through [SessionRepository]'s outbox, so a whole workout can be logged offline.
 */
@HiltViewModel(assistedFactory = SessionViewModel.Factory::class)
class SessionViewModel @AssistedInject constructor(
    @Assisted private val habitId: Int,
    @Assisted private val day: LocalDate,
    private val sessions: SessionRepository,
    tracker: TrackerRepository,
    auth: AuthRepository,
) : ViewModel() {
    @AssistedFactory
    interface Factory {
        fun create(habitId: Int, day: LocalDate): SessionViewModel
    }

    private val refreshing = MutableStateFlow(false)
    private val message = MutableStateFlow<SessionMessage?>(null)

    private val preferences = auth.state.map { state ->
        val user = (state as? AuthState.SignedIn)?.user
        // Unknown values (a newer server) read as the defaults, as on the web.
        val units = user?.unitSystem?.takeIf { it != UnitSystem.Unknown } ?: UnitSystem.Metric
        val style = user?.exerciseLogCardStyle?.takeIf { it != ExerciseLogCardStyle.Unknown } ?: ExerciseLogCardStyle.Classic
        units to style
    }

    private val content = combine(
        tracker.observeHabit(habitId, day).map<_, TrackedHabit?> { it }.onStart { emit(null) },
        sessions.observeSessions(habitId, day).map<_, List<TrackedSession>?> { it }.onStart { emit(null) },
        sessions.observeExercises().onStart { emit(emptyList()) },
    ) { habit, sessions, exercises -> Triple(habit, sessions, exercises) }

    val state: StateFlow<SessionUiState> = combine(content, preferences, refreshing, message) { content, prefs, refreshing, message ->
        SessionUiState(
            day = day,
            habit = content.first,
            sessions = content.second,
            exercises = content.third,
            unitSystem = prefs.first,
            cardStyle = prefs.second,
            refreshing = refreshing,
            message = message,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SessionUiState(day))

    init {
        // The day's sessions may be on the server only (logged on the web), and the catalog may be stale.
        refresh()
    }

    fun refresh() {
        if (!refreshing.compareAndSet(expect = false, update = true)) return
        viewModelScope.launch {
            try {
                when (sessions.refresh(habitId, day)) {
                    SyncResult.Done, SyncResult.SignedOut -> Unit
                    SyncResult.Retry -> message.value = SessionMessage.Offline
                    SyncResult.Failed -> message.value = SessionMessage.SyncFailed
                }
            } finally {
                refreshing.value = false
            }
        }
    }

    fun startSession() = write { sessions.startSession(habitId, day) }

    fun deleteSession(sessionId: String) = write { sessions.deleteSession(sessionId) }

    fun addExercise(sessionId: String, exerciseId: Int) = write { sessions.addExercise(sessionId, exerciseId) }

    fun removeExercise(logId: String) = write { sessions.removeExercise(logId) }

    /** Adds a set to [logId], starting from the exercise's last performance. */
    fun addSet(logId: String) = write { sessions.addSet(logId) }

    fun updateSet(setId: String, values: SetValues) = write { sessions.updateSet(setId, values) }

    fun deleteSet(setId: String) = write { sessions.deleteSet(setId) }

    /** Clears [shown] unless a newer message has replaced it. */
    fun onMessageShown(shown: SessionMessage) {
        message.compareAndSet(shown, null)
    }

    private fun write(block: suspend () -> WriteResult) {
        viewModelScope.launch {
            when (block()) {
                WriteResult.HabitFrozen -> message.value = SessionMessage.HabitFrozen
                WriteResult.ExerciseFrozen -> message.value = SessionMessage.ExerciseFrozen
                // A missing habit or row was deleted by a sync; the screen follows Room.
                WriteResult.Queued, WriteResult.HabitNotFound, WriteResult.NoChange -> Unit
            }
        }
    }
}
