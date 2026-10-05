package com.trackbit.core.model

import com.trackbit.core.model.serialization.InstantSerializer
import kotlinx.serialization.Serializable
import java.time.Instant

/** A row of `GET /api/exercise-lists`, and the answer of every list write but delete. */
@Serializable
data class ExerciseList(
    val id: Int,
    val userId: String,
    /** Who wrote the list: [userId] for self-made lists, null for lists older than authorship. */
    val authorId: String?,
    val name: String,
    val description: String?,
    val position: Int,
    @Serializable(with = InstantSerializer::class) val createdAt: Instant?,
    @Serializable(with = InstantSerializer::class) val updatedAt: Instant?,
    val items: List<ExerciseListItem>,
    /** Over the role's list cap: read-only until it or another list is deleted. */
    val frozen: Boolean,
)

/** An entry of a list. The `target*` fields and [restSeconds] form an optional prescription. */
@Serializable
data class ExerciseListItem(
    val id: Int,
    val listId: Int,
    val exerciseId: Int,
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
