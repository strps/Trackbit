package com.trackbit.core.model

import com.trackbit.core.model.serialization.FallbackEnumSerializer
import com.trackbit.core.model.serialization.WireEnum
import kotlinx.serialization.Serializable

/** `exercises.category`: what a log of the exercise records. */
@Serializable(with = ExerciseCategory.Serializer::class)
enum class ExerciseCategory(override val wire: String?) : WireEnum {
    Strength("strength"),
    Cardio("cardio"),
    Flexibility("flexibility"),
    Unknown(null);

    object Serializer : FallbackEnumSerializer<ExerciseCategory>("ExerciseCategory", entries, Unknown)

    companion object {
        /** The categories the form offers. */
        val FORM = listOf(Strength, Cardio, Flexibility)

        fun of(wire: String?): ExerciseCategory = Serializer.fromWire(wire)
    }
}

/**
 * `POST /api/exercise-info/exercises` and `PATCH …/:id`: every field the custom exercise form
 * edits, all sent each time (a null [description] clears it, an empty [muscleGroups] unlinks
 * them all). The units keep their server defaults; the form doesn't show them.
 */
@Serializable
data class ExerciseRequest(
    val name: String,
    val description: String?,
    val category: ExerciseCategory,
    /** [MuscleGroup] ids. */
    val muscleGroups: List<Int>,
) {
    init {
        val problems = ExerciseRules.problems(name, description, category)
        require(problems.isEmpty()) { "Invalid exercise: $problems" }
    }
}

/** The custom exercise form's rules, the same the server enforces on create and update. */
object ExerciseRules {
    val NAME_LENGTH = 1..100
    const val DESCRIPTION_MAX = 500

    enum class Problem { NameLength, DescriptionLength, Category }

    /** Everything wrong with these values; empty when the server would accept them. */
    fun problems(name: String, description: String?, category: ExerciseCategory): Set<Problem> = buildSet {
        if (name.trim().length !in NAME_LENGTH) add(Problem.NameLength)
        if ((description?.trim()?.length ?: 0) > DESCRIPTION_MAX) add(Problem.DescriptionLength)
        if (category == ExerciseCategory.Unknown) add(Problem.Category)
    }
}
