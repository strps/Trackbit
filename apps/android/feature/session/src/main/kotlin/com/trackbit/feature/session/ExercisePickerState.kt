package com.trackbit.feature.session

import com.trackbit.core.data.SourceQueue
import com.trackbit.core.data.TrackedSession
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.QueueEmptyReason
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.model.QueueLog
import com.trackbit.core.model.nextQueueIndex
import com.trackbit.core.model.queueDone

/**
 * A session's exercise picker, like the web's `ExercisePicker`: the active source's queue with
 * its cursor, or browse mode (the whole catalog, which is not a source). Everything here is
 * derived from the session's logs; nothing about the cursor is stored.
 */
internal data class ExercisePickerState(
    /** The active source; null is browse mode. */
    val source: ExerciseSourceDescriptor?,
    /** The source's queue hasn't been pulled yet (first use, offline). */
    val queueLoading: Boolean,
    val entries: List<QueueEntry>,
    /** Per entry of [entries]: logged in this session already. */
    val done: List<Boolean>,
    /** The index in [entries] of what Play adds next; -1 when there is none. */
    val cursor: Int,
    val emptyReason: QueueEmptyReason?,
    /** What the trigger names and Play adds: the cursor's exercise, or in browse mode the last pick. */
    val selected: Exercise?,
    private val exercises: List<Exercise>,
    private val exercisesById: Map<Int, Exercise>,
) {
    val browsing: Boolean get() = source == null

    /** The entry Play adds (with its list item), or null to add [selected] ad hoc. */
    val nextEntry: QueueEntry? get() = entries.getOrNull(cursor)

    /** The source's entries that the catalog knows, in queue order. */
    val queueRows: List<PickerRow>
        get() = entries.mapIndexedNotNull { i, entry -> exercisesById[entry.exerciseId]?.let { row(it, i) } }

    /**
     * The catalog filtered by [query]. A search always covers the whole catalog (a source is
     * short); an exercise in the queue keeps its link to it (its first entry not done yet), so
     * picking it from the results still moves the cursor on.
     */
    fun search(query: String): List<PickerRow> {
        val linked = HashMap<Int, Int>()
        if (!browsing) {
            entries.forEachIndexed { i, entry ->
                val current = linked[entry.exerciseId]
                if (current == null || (done[current] && !done[i])) linked[entry.exerciseId] = i
            }
        }
        val q = query.trim()
        return exercises.filter { it.name.contains(q, ignoreCase = true) }.map { exercise -> row(exercise, linked[exercise.id]) }
    }

    private fun row(exercise: Exercise, index: Int?) = PickerRow(
        exercise = exercise,
        entry = index?.let { entries[it] },
        highlighted = index != null && index == cursor,
        done = index != null && done[index],
    )
}

/** One exercise in the picker; [entry] is set when it stands for an entry of the source's queue. */
internal data class PickerRow(
    val exercise: Exercise,
    val entry: QueueEntry?,
    /** It is the cursor: what Play adds next. */
    val highlighted: Boolean,
    val done: Boolean,
)

/**
 * The picker of [session]. A source that no longer resolves ([SourceQueue.Gone]) is browse mode.
 * [browsePick] is the exercise last picked in browse mode; without one, Play repeats the
 * session's last logged exercise, so a resumed session finds it armed.
 */
internal fun exercisePicker(state: SessionUiState, session: TrackedSession, browsePick: Int?): ExercisePickerState {
    val queue = state.queue
    val source = state.source.takeIf { queue !is SourceQueue.Gone }
    val resolved = (queue as? SourceQueue.Resolved).takeIf { source != null }
    val entries = resolved?.entries.orEmpty()
    val logs = session.logs.map { QueueLog(it.exerciseId, it.listItemId) }
    val cursor = nextQueueIndex(entries, logs)
    val selectedId = when {
        source == null -> browsePick ?: session.logs.lastOrNull()?.exerciseId
        else -> entries.getOrNull(cursor)?.exerciseId
    }
    return ExercisePickerState(
        source = source,
        queueLoading = source != null && queue == null,
        entries = entries,
        done = queueDone(entries, logs),
        cursor = cursor,
        emptyReason = resolved?.emptyReason,
        selected = selectedId?.let(state::exercise),
        exercises = state.exercises,
        exercisesById = state.exercisesById,
    )
}
