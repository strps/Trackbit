package com.trackbit.core.model

import kotlinx.serialization.Serializable

/**
 * `POST /api/exercise-lists` and `PATCH …/:id`: the list's name and description, both sent each
 * time (a null [description] clears it).
 */
@Serializable
data class ExerciseListRequest(val name: String, val description: String?) {
    init {
        val problems = ExerciseListRules.problems(name, description)
        require(problems.isEmpty()) { "Invalid list: $problems" }
    }
}

/** `PATCH /api/exercise-lists/reorder`: every one of the user's lists, in its new order. */
@Serializable
data class ExerciseListReorderRequest(val ids: List<Int>)

/** `POST /api/exercise-lists/:id/items`: appends one exercise, unprescribed. */
@Serializable
data class AppendListItemRequest(val exerciseId: Int)

/** `PUT /api/exercise-lists/:id/items`: the list's items, replacing all of them, in order. */
@Serializable
data class ExerciseListItemsRequest(val items: List<ExerciseListItemInput>) {
    init {
        require(items.size <= ExerciseListRules.MAX_ITEMS) { "A list holds at most ${ExerciseListRules.MAX_ITEMS} items" }
    }

    companion object {
        /** [items] in this order, numbered from 0: an item with an id keeps its row (and the logs that came from it). */
        fun of(items: List<ListItemDraft>) = ExerciseListItemsRequest(
            items.mapIndexed { position, item -> ExerciseListItemInput.of(item, position) },
        )
    }
}

/** One item of [ExerciseListItemsRequest]. Every target is sent, null included (not prescribed). */
@Serializable
data class ExerciseListItemInput(
    /** Null for a new item: left out of the body. */
    val id: Int? = null,
    val exerciseId: Int,
    val position: Int,
    val targetSets: Int?,
    val targetReps: Int?,
    val targetWeight: Double?,
    val targetDuration: Int?,
    val targetDistance: Double?,
    val restSeconds: Int?,
    val notes: String?,
) {
    companion object {
        fun of(item: ListItemDraft, position: Int): ExerciseListItemInput {
            val p = item.prescription
            require(ExerciseListRules.problems(p).isEmpty()) { "Invalid prescription: ${ExerciseListRules.problems(p)}" }
            return ExerciseListItemInput(
                id = item.id,
                exerciseId = item.exerciseId,
                position = position,
                targetSets = p.targetSets,
                targetReps = p.targetReps,
                targetWeight = p.targetWeight,
                targetDuration = p.targetDuration,
                targetDistance = p.targetDistance,
                restSeconds = p.restSeconds,
                notes = p.notes?.trim()?.ifEmpty { null },
            )
        }
    }
}

/** An item as the editor holds it: [id] null until the server has stored it. */
data class ListItemDraft(val id: Int?, val exerciseId: Int, val prescription: Prescription)

/** `PUT` and `POST /api/exercise-lists/:id/items`: the list's items after the write. */
@Serializable
data class ExerciseListItemsResponse(val listId: Int, val items: List<ExerciseListItem>)

/** The item's targets; every field null when nothing is prescribed. */
val ExerciseListItem.prescription: Prescription
    get() = Prescription(targetSets, targetReps, targetWeight, targetDuration, targetDistance, restSeconds, notes)

val ExerciseListItem.draft: ListItemDraft get() = ListItemDraft(id, exerciseId, prescription)

/** The list editor's rules, the same the server enforces (`exercise-lists.ts`). */
object ExerciseListRules {
    val NAME_LENGTH = 1..120
    const val DESCRIPTION_MAX = 500
    const val NOTES_MAX = 500
    const val MAX_ITEMS = 100

    val SETS = 1..50
    val REPS = 1..1000

    /** Kilograms, above 0. */
    const val WEIGHT_MAX_KG = 1000.0

    /** Seconds. */
    val DURATION = 1..86_400

    /** Kilometres, above 0. */
    const val DISTANCE_MAX_KM = 1000.0

    /** Seconds; 0 is "no rest". */
    val REST = 0..3600

    enum class Problem { NameLength, DescriptionLength }

    enum class Target { Sets, Reps, Weight, Duration, Distance, Rest, Notes }

    /** Everything wrong with a list's name and description; empty when the server would accept them. */
    fun problems(name: String, description: String?): Set<Problem> = buildSet {
        if (name.trim().length !in NAME_LENGTH) add(Problem.NameLength)
        if ((description?.trim()?.length ?: 0) > DESCRIPTION_MAX) add(Problem.DescriptionLength)
    }

    /** The targets of [prescription] the server would refuse. */
    fun problems(prescription: Prescription): Set<Target> = buildSet {
        with(prescription) {
            if (targetSets != null && targetSets !in SETS) add(Target.Sets)
            if (targetReps != null && targetReps !in REPS) add(Target.Reps)
            if (targetWeight != null && !(targetWeight > 0 && targetWeight <= WEIGHT_MAX_KG)) add(Target.Weight)
            if (targetDuration != null && targetDuration !in DURATION) add(Target.Duration)
            if (targetDistance != null && !(targetDistance > 0 && targetDistance <= DISTANCE_MAX_KM)) add(Target.Distance)
            if (restSeconds != null && restSeconds !in REST) add(Target.Rest)
            if ((notes?.trim()?.length ?: 0) > NOTES_MAX) add(Target.Notes)
        }
    }
}
