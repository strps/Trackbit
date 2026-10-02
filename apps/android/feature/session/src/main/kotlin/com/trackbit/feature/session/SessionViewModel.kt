package com.trackbit.feature.session

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.auth.PreferencesRepository
import com.trackbit.core.data.SessionRepository
import com.trackbit.core.data.SourceQueue
import com.trackbit.core.data.SyncResult
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackedSession
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.data.WriteResult
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.SetValues
import com.trackbit.core.model.UnitSystem
import dagger.assisted.Assisted
import dagger.assisted.AssistedFactory
import dagger.assisted.AssistedInject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.ExperimentalCoroutinesApi
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
    /** The picker's sources, in the server's order. */
    val sources: List<ExerciseSourceDescriptor> = emptyList(),
    /** [sources] is known: Room has some, or a pull answered. Until then "no lists" isn't shown. */
    val sourcesLoaded: Boolean = false,
    /** The preferred source, if it is one of [sources]; null is browse mode. */
    val source: ExerciseSourceDescriptor? = null,
    /** [source]'s queue as last pulled; null if never pulled (or browsing). */
    val queue: SourceQueue? = null,
    val refreshing: Boolean = false,
    val message: SessionMessage? = null,
) {
    internal val exercisesById: Map<Int, Exercise> = exercises.associateBy { it.id }

    fun exercise(id: Int): Exercise? = exercisesById[id]

    /** A frozen habit's session is shown read-only, like its tracker row. */
    val readOnly: Boolean get() = habit?.frozen == true
}

enum class SessionMessage { Offline, SyncFailed, HabitFrozen, ExerciseFrozen }

/**
 * A workout habit's sessions on one day, like the web's activity tracker. Reads come from Room;
 * every write goes through [SessionRepository]'s outbox, so a whole workout can be logged offline.
 */
@OptIn(ExperimentalCoroutinesApi::class)
@HiltViewModel(assistedFactory = SessionViewModel.Factory::class)
class SessionViewModel @AssistedInject constructor(
    @Assisted private val habitId: Int,
    @Assisted private val day: LocalDate,
    private val sessions: SessionRepository,
    tracker: TrackerRepository,
    auth: AuthRepository,
    private val preferences: PreferencesRepository,
) : ViewModel() {
    @AssistedFactory
    interface Factory {
        fun create(habitId: Int, day: LocalDate): SessionViewModel
    }

    private val refreshing = MutableStateFlow(false)
    private val message = MutableStateFlow<SessionMessage?>(null)

    /** A pull of the sources answered, so a preferred key missing from them really dangles. */
    private val sourcesPulled = MutableStateFlow(false)

    private val user = auth.state.map { (it as? AuthState.SignedIn)?.user }

    private val display = user.map { user ->
        // Unknown values (a newer server) read as the defaults, as on the web.
        val units = user?.unitSystem?.takeIf { it != UnitSystem.Unknown } ?: UnitSystem.Metric
        val style = user?.exerciseLogCardStyle?.takeIf { it != ExerciseLogCardStyle.Unknown } ?: ExerciseLogCardStyle.Classic
        units to style
    }

    /**
     * The sources, and the preferred one resolved through them: the one guard that turns a key
     * that no longer names a source (a deleted list) into browse mode.
     */
    private val sourcePick = combine(
        sessions.observeSources(),
        user.map { it?.preferredExerciseSource }.distinctUntilChanged(),
        sourcesPulled,
    ) { sources, key, pulled ->
        SourcePick(sources, pulled = pulled, key = key, source = sources.find { it.key == key })
    }

    private val queue = sourcePick.map { it.source?.key }.distinctUntilChanged().flatMapLatest { key ->
        if (key == null) flowOf(null) else sessions.observeQueue(key)
    }

    private val content = combine(
        tracker.observeHabit(habitId, day).map<_, TrackedHabit?> { it }.onStart { emit(null) },
        sessions.observeSessions(habitId, day).map<_, List<TrackedSession>?> { it }.onStart { emit(null) },
        sessions.observeExercises().onStart { emit(emptyList()) },
    ) { habit, sessions, exercises -> Triple(habit, sessions, exercises) }

    private val picker = combine(sourcePick, queue) { pick, queue -> pick to queue }

    val state: StateFlow<SessionUiState> = combine(content, display, picker, refreshing, message) { content, display, picker, refreshing, message ->
        val (pick, queue) = picker
        SessionUiState(
            day = day,
            habit = content.first,
            sessions = content.second,
            exercises = content.third,
            unitSystem = display.first,
            cardStyle = display.second,
            sources = pick.sources,
            sourcesLoaded = pick.pulled || pick.sources.isNotEmpty(),
            source = pick.source,
            queue = queue,
            refreshing = refreshing,
            message = message,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), SessionUiState(day))

    init {
        // The day's sessions may be on the server only (logged on the web), and the catalog may be stale.
        refresh(queue = false)
        // Each source picked (or found at start) gets a fresh queue; Room keeps the last copy offline.
        viewModelScope.launch {
            sourcePick.map { it.source?.key }.distinctUntilChanged().filterNotNull().collect { sessions.refreshQueue(it) }
        }
        // A stored key that no longer names a source is cleared, but only once a pull has said so:
        // a slow or failed pull must not wipe a good preference.
        viewModelScope.launch {
            sourcePick.collect { pick ->
                if (pick.dangles) preferences.setPreferredExerciseSource(null)
            }
        }
    }

    /** Pull-to-refresh: the day's sessions, the catalog, the sources and the active source's queue. */
    fun refresh() = refresh(queue = true)

    private fun refresh(queue: Boolean) {
        if (!refreshing.compareAndSet(expect = false, update = true)) return
        viewModelScope.launch {
            try {
                val result = sessions.refresh(habitId, day)
                if (result == SyncResult.Done) {
                    sourcesPulled.value = true
                    if (queue) sourcePick.first().source?.let { sessions.refreshQueue(it.key) }
                }
                when (result) {
                    SyncResult.Done, SyncResult.SignedOut -> Unit
                    SyncResult.Retry -> message.value = SessionMessage.Offline
                    SyncResult.Failed -> message.value = SessionMessage.SyncFailed
                }
            } finally {
                refreshing.value = false
            }
        }
    }

    /** Makes [key] the picker's source for every session (a user preference); null is browse mode. */
    fun selectSource(key: String?) {
        viewModelScope.launch { preferences.setPreferredExerciseSource(key) }
    }

    fun startSession() = write { sessions.startSession(habitId, day) }

    fun deleteSession(sessionId: String) = write { sessions.deleteSession(sessionId) }

    /** Adds [exerciseId] to a session; [listItemId] is the queue entry it was picked as, if any. */
    fun addExercise(sessionId: String, exerciseId: Int, listItemId: Int?) =
        write { sessions.addExercise(sessionId, exerciseId, listItemId) }

    fun removeExercise(logId: String) = write { sessions.removeExercise(logId) }

    /** Adds a set to [logId], starting from its prescription or the exercise's last performance. */
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

private data class SourcePick(
    val sources: List<ExerciseSourceDescriptor>,
    /** [sources] is this screen's own pull, not an older copy that may predate a new list. */
    val pulled: Boolean,
    val key: String?,
    val source: ExerciseSourceDescriptor?,
) {
    val dangles: Boolean get() = pulled && key != null && source == null
}
