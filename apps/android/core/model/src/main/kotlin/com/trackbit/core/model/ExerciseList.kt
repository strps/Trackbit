package com.trackbit.core.model

import kotlinx.serialization.Serializable

/** A row of `GET /api/exercise-lists`, and the answer of every list write but delete. */
@Serializable
data class ExerciseList(
    /** The app names a list by it; the server's int `id` is the web's. */
    val uuid: String,
    val name: String,
    val description: String?,
    /** The list's place in the user's order. */
    val position: Int,
    val items: List<ExerciseListItem>,
    /** Over the role's list cap: read-only until it or another list is deleted. */
    val frozen: Boolean,
)

/** An entry of a list. The `target*` fields and [restSeconds] form an optional prescription. */
@Serializable
data class ExerciseListItem(
    /** Logs made from the item name it by this ([ExerciseLog.listItemUuid]). */
    val uuid: String,
    val exerciseUuid: String,
    val position: Int,
    val targetSets: Int?,
    val targetReps: Int?,
    /** Kilograms. */
    val targetWeight: Double?,
    /** Seconds. */
    val targetDuration: Int?,
    /** Kilometres. */
    val targetDistance: Double?,
    val restSeconds: Int?,
    val notes: String?,
)
