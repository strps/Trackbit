package com.trackbit.core.model

import com.trackbit.core.model.serialization.FallbackEnumSerializer
import com.trackbit.core.model.serialization.InstantSerializer
import com.trackbit.core.model.serialization.WireEnum
import kotlinx.serialization.Serializable
import java.time.Instant

// Exercise sources: what the session picker offers besides the whole catalog (browse mode, which
// is not a source). See docs/dev/tasks/exercise-programs.md. The app names a source by its
// canonical [ExerciseSourceDescriptor.key] (`list:<uuid>`, `program:3`, `computed:<strategy>`) and
// never parses it: the server's `ref` is left undecoded, so a new source kind needs no app change.

/** A row of `GET /api/exercise-sources`: what the source dropdown lists. */
@Serializable
data class ExerciseSourceDescriptor(
    val key: String,
    /** User content, never translated. Null for a system-named source, which has [nameKey]. */
    val name: String?,
    /** An i18n key (`tracker` namespace) for a system-named source. */
    val nameKey: String? = null,
    /** Null when the server can't know before resolving it. */
    val itemCount: Int?,
    val capabilities: SourceCapabilities,
    /** Over the user's role limits: read-only, but still a source to pick from. */
    val frozen: Boolean,
)

/** What a source can do, derived by the server: the picker asks these, never the source's kind. */
@Serializable
data class SourceCapabilities(
    val canAppend: Boolean,
    val canReorder: Boolean,
    /** Its entries may carry prescriptions. */
    val prescribes: Boolean,
    /** Changes without the user editing it (programs, computed sources). */
    val isDynamic: Boolean,
)

/** `GET /api/exercise-sources/:key`: a source's queue. An unknown or unowned key answers 404. */
@Serializable
data class ResolvedQueue(
    val descriptor: ExerciseSourceDescriptor,
    val entries: List<QueueEntry>,
    /** Why [entries] is empty; null when it isn't. */
    val emptyReason: QueueEmptyReason? = null,
    @Serializable(with = InstantSerializer::class) val generatedAt: Instant?,
)

@Serializable
data class QueueEntry(
    /** The app names it from its own exercise catalog. */
    val exerciseUuid: String,
    val position: Int,
    /** The list item it comes from (a log's provenance); null for computed sources. */
    val listItemUuid: String?,
    /** Null when nothing is prescribed. */
    val prescription: Prescription?,
)

/** A list item's targets: what a new set of it starts with. Weights are kg and distances km, like sets. */
@Serializable
data class Prescription(
    val targetSets: Int?,
    val targetReps: Int?,
    val targetWeight: Double?,
    /** Seconds. */
    val targetDuration: Int?,
    val targetDistance: Double?,
    val restSeconds: Int?,
    val notes: String?,
) {
    val isEmpty: Boolean get() = this == NONE

    companion object {
        /** Nothing prescribed. */
        val NONE = Prescription(null, null, null, null, null, null, null)
    }
}

/** `ResolvedQueue.emptyReason`. */
@Serializable(with = QueueEmptyReason.Serializer::class)
enum class QueueEmptyReason(override val wire: String?) : WireEnum {
    RestDay("rest_day"),
    NoRoutineScheduled("no_routine_scheduled"),
    ListEmpty("list_empty"),
    NoData("no_data"),
    Unknown(null);

    object Serializer : FallbackEnumSerializer<QueueEmptyReason>("QueueEmptyReason", entries, Unknown)
}

/** The part of a session's log that the queue cursor reads. */
data class QueueLog(val exerciseUuid: String, val listItemUuid: String?)

/**
 * Which of [entries] are done in a session with [logs]: an entry is done when a log came from
 * that exact list item, so a routine that repeats an exercise (top set, then backoff) still
 * advances. Entries without a list item (computed sources) match by exercise.
 */
fun queueDone(entries: List<QueueEntry>, logs: List<QueueLog>): List<Boolean> {
    val doneItems = logs.mapNotNullTo(HashSet()) { it.listItemUuid }
    val doneExercises = logs.mapTo(HashSet()) { it.exerciseUuid }
    return entries.map { entry ->
        if (entry.listItemUuid != null) entry.listItemUuid in doneItems else entry.exerciseUuid in doneExercises
    }
}

/**
 * The queue's cursor in a session with [logs] (oldest first), like the web's `nextQueueIndex`:
 * the first entry not done; once every entry is done, the one after the most recently logged
 * entry, cycling. -1 for an empty queue. It is derived, never stored.
 */
fun nextQueueIndex(entries: List<QueueEntry>, logs: List<QueueLog>): Int {
    if (entries.isEmpty()) return -1
    val firstPending = queueDone(entries, logs).indexOf(false)
    if (firstPending != -1) return firstPending
    for (log in logs.asReversed()) {
        val last = entries.indexOfFirst { entry ->
            if (log.listItemUuid != null) entry.listItemUuid == log.listItemUuid else entry.exerciseUuid == log.exerciseUuid
        }
        if (last != -1) return (last + 1) % entries.size
    }
    return 0
}
