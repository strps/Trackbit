package com.trackbit.core.model

import com.trackbit.core.model.serialization.InstantSerializer
import kotlinx.serialization.Serializable
import java.time.Instant

/** A row of `GET /api/exercise-lists`. */
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
    /** Present on reads and create; an update returns the bare list. */
    val items: List<ExerciseListItem> = emptyList(),
    val frozen: Boolean = false,
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
    val targetWeight: Double?,
    /** Seconds. */
    val targetDuration: Int?,
    val targetDistance: Double?,
    val restSeconds: Int?,
    val notes: String?,
)
