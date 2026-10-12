package com.trackbit.core.database.entity

import androidx.room.ColumnInfo
import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseMediaRef
import com.trackbit.core.model.LastPerformance
import com.trackbit.core.model.MuscleGroupRef
import com.trackbit.core.model.RecentLog
import java.time.Instant

/**
 * The exercise catalog as of the last `GET /api/exercise-info/exercises`: system exercises plus
 * the user's own, named in the locale of that request. The picker, sessions and analytics read
 * it, and so does the library.
 */
@Entity(tableName = ExerciseEntity.TABLE)
data class ExerciseEntity(
    @PrimaryKey val uuid: String,
    /** Null for a system exercise. */
    val userId: String?,
    val name: String,
    /** Localized like [name]. */
    val description: String?,
    val category: String,
    val defaultWeightUnit: String?,
    val defaultDistanceUnit: String?,
    val frozen: Boolean,
    /** Named in the locale of that request, like [name]. */
    @ColumnInfo(defaultValue = "[]") val muscleGroups: List<MuscleGroupRef>,
    /** The user's most recent set of it on the server; null if they never logged one. */
    @Embedded(prefix = "last_") val lastPerformance: LastPerformanceColumns?,
    // The info sheet's fields, as [Exercise] has them. Step lists are JSON, null when it has none.
    val instructions: List<String>?,
    val tips: List<String>?,
    val commonMistakes: List<String>?,
    @ColumnInfo(defaultValue = "[]") val equipment: List<String>,
    val difficulty: String?,
    /** Not a foreign key, like [ExerciseLogEntity.exerciseUuid]: the catalog is replaced wholesale. */
    val variantOfUuid: String?,
    /** The server's two latest logs of it with sets; Room's own logs may be newer (offline). */
    @ColumnInfo(defaultValue = "[]") val recentLogs: List<RecentLog>,
    @ColumnInfo(defaultValue = "[]") val media: List<ExerciseMediaRef>,
) {
    fun toExercise() = Exercise(
        uuid = uuid,
        userId = userId,
        name = name,
        description = description,
        category = category,
        defaultWeightUnit = defaultWeightUnit,
        defaultDistanceUnit = defaultDistanceUnit,
        lastPerformance = lastPerformance?.let {
            LastPerformance(it.id, it.weight, it.reps, it.distance, it.duration, it.createdAt, it.rpe)
        },
        muscleGroups = muscleGroups,
        frozen = frozen,
        instructions = instructions,
        tips = tips,
        commonMistakes = commonMistakes,
        equipment = equipment,
        difficulty = difficulty,
        variantOfUuid = variantOfUuid,
        recentLogs = recentLogs,
        media = media,
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
    uuid = uuid,
    userId = userId,
    name = name,
    description = description,
    category = category,
    defaultWeightUnit = defaultWeightUnit,
    defaultDistanceUnit = defaultDistanceUnit,
    frozen = frozen,
    muscleGroups = muscleGroups,
    lastPerformance = lastPerformance?.let {
        LastPerformanceColumns(it.id, it.weight, it.reps, it.distance, it.duration, it.createdAt, it.rpe)
    },
    instructions = instructions,
    tips = tips,
    commonMistakes = commonMistakes,
    equipment = equipment,
    difficulty = difficulty,
    variantOfUuid = variantOfUuid,
    recentLogs = recentLogs,
    media = media,
)
