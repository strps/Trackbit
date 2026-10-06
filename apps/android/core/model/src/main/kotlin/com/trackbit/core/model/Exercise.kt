package com.trackbit.core.model

import com.trackbit.core.model.serialization.InstantSerializer
import kotlinx.serialization.Serializable
import java.time.Instant

/** A row of `GET /api/exercise-info/exercises`: system exercises plus the user's own. */
@Serializable
data class Exercise(
    /** The app names an exercise by it; the server's int `id` is the web's. */
    val uuid: String,
    /** Null for a system exercise. */
    val userId: String?,
    /** Already localized for the request's locale. */
    val name: String,
    /** Localized like [name]; null when it has none. */
    val description: String? = null,
    /** An [ExerciseCategory] wire name. */
    val category: String,
    val defaultWeightUnit: String?,
    val defaultDistanceUnit: String?,
    /** The user's most recent set of this exercise, or null if they never logged one. */
    val lastPerformance: LastPerformance?,
    /** Named in the user's locale, like [name]. */
    val muscleGroups: List<MuscleGroupRef> = emptyList(),
    val frozen: Boolean = false,
)

@Serializable
data class MuscleGroupRef(val id: Int, val name: String)

/** A row of `GET /api/exercise-info/muscle-groups`: the shared taxonomy, named in the request's locale. */
@Serializable
data class MuscleGroup(
    val id: Int,
    val name: String,
    val slug: String,
    val parentId: Int?,
    /** 1 for a major group, 2 for a subdivision, deeper after that. */
    val level: Int,
    val displayOrder: Int?,
)

@Serializable
data class LastPerformance(
    val id: Int,
    val weight: Double?,
    val reps: Int?,
    val distance: Double?,
    /** Milliseconds. */
    val duration: Int?,
    @Serializable(with = InstantSerializer::class) val createdAt: Instant?,
    val rpe: Int?,
)

// Sessions, logs and sets are identified by [ExerciseSession.uuid] and friends: the app picks it
// when it creates the row (offline, before the server has an `id`), and the server keeps it.
// `id` is the server's key, which only the web uses. They name their exercise and list item by
// uuid too.

@Serializable
data class ExerciseSession(
    val id: Int,
    val uuid: String,
    val dayLogId: Int,
    @Serializable(with = InstantSerializer::class) val createdAt: Instant?,
)

/** A row of `GET /api/tracker/exercise-sessions`: a session with its logs and their sets. */
@Serializable
data class ExerciseSessionDetail(
    val id: Int,
    val uuid: String,
    val dayLogId: Int,
    @Serializable(with = InstantSerializer::class) val createdAt: Instant?,
    val exerciseLogs: List<ExerciseLogDetail>,
)

@Serializable
data class ExerciseLogDetail(
    val id: Int,
    val uuid: String,
    val exerciseUuid: String,
    /** The list item this was logged from, or null for an ad-hoc log. */
    val listItemUuid: String?,
    @Serializable(with = InstantSerializer::class) val createdAt: Instant?,
    val distance: Double?,
    /** Seconds. */
    val duration: Int?,
    val distanceUnit: String?,
    val weightUnit: String?,
    val exercisePerformances: List<ExercisePerformance>,
)

@Serializable
data class ExerciseLog(
    val id: Int,
    val uuid: String,
    val exerciseUuid: String,
    val exerciseSessionId: Int,
    /** The list item this was logged from, or null for an ad-hoc log. */
    val listItemUuid: String?,
    @Serializable(with = InstantSerializer::class) val createdAt: Instant?,
    val distance: Double?,
    /** Seconds. */
    val duration: Int?,
    val distanceUnit: String?,
    val weightUnit: String?,
)

/** One set. */
@Serializable
data class ExercisePerformance(
    val id: Int,
    val uuid: String,
    val number: Int,
    val exerciseLogId: Int,
    val reps: Int?,
    val weight: Double?,
    /** Milliseconds. */
    val duration: Int?,
    val distance: Double?,
    val rpe: Int?,
    @Serializable(with = InstantSerializer::class) val createdAt: Instant?,
) {
    val values: SetValues get() = SetValues(reps = reps, weight = weight, duration = duration, distance = distance, rpe = rpe)
}
