package com.trackbit.core.database.entity

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.LastPerformance
import java.time.Instant

/**
 * The exercise catalog as of the last `GET /api/exercise-info/exercises`: system exercises plus
 * the user's own, named in the locale of that request.
 */
@Entity(tableName = ExerciseEntity.TABLE)
data class ExerciseEntity(
    @PrimaryKey val id: Int,
    /** Null for a system exercise. */
    val userId: String?,
    val name: String,
    val category: String,
    val defaultWeightUnit: String?,
    val defaultDistanceUnit: String?,
    val frozen: Boolean,
    /** The user's most recent set of it on the server; null if they never logged one. */
    @Embedded(prefix = "last_") val lastPerformance: LastPerformanceColumns?,
) {
    fun toExercise() = Exercise(
        id = id,
        userId = userId,
        name = name,
        category = category,
        defaultWeightUnit = defaultWeightUnit,
        defaultDistanceUnit = defaultDistanceUnit,
        lastPerformance = lastPerformance?.let {
            LastPerformance(it.id, it.weight, it.reps, it.distance, it.duration, it.createdAt, it.rpe)
        },
        frozen = frozen,
    )

    companion object {
        const val TABLE = "exercises"
    }
}

data class LastPerformanceColumns(
    val id: Int,
    val weight: Double?,
    val reps: Int?,
    val distance: Double?,
    val duration: Int?,
    val createdAt: Instant?,
    val rpe: Int?,
)

fun Exercise.toEntity() = ExerciseEntity(
    id = id,
    userId = userId,
    name = name,
    category = category,
    defaultWeightUnit = defaultWeightUnit,
    defaultDistanceUnit = defaultDistanceUnit,
    frozen = frozen,
    lastPerformance = lastPerformance?.let {
        LastPerformanceColumns(it.id, it.weight, it.reps, it.distance, it.duration, it.createdAt, it.rpe)
    },
)
