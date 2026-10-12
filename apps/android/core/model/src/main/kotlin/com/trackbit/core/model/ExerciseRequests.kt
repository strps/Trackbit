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
 * `POST /api/exercise-info/exercises` and `PATCH …/uuid/:uuid`: every field the custom exercise form
 * edits, all sent each time (a null [description], step list, [difficulty] or [variantOfUuid]
 * clears it; an empty [muscleGroups] or [equipment] unlinks them all). None has a default, so
 * none is ever left out. The units keep their server defaults; the form doesn't show them.
 */
@Serializable
data class ExerciseRequest(
    val name: String,
    val description: String?,
    val category: ExerciseCategory,
    /** [MuscleGroup] ids. */
    val muscleGroups: List<Int>,
    /** Ordered steps, as [ExerciseRules.steps] leaves them. */
    val instructions: List<String>?,
    val tips: List<String>?,
    val commonMistakes: List<String>?,
    val equipment: List<ExerciseEquipment>,
    val difficulty: ExerciseDifficulty?,
    /** The base exercise this is a variant of; null for none. */
    val variantOfUuid: String?,
    /** A create's new uuid, which makes a retry return the first exercise; null (left out) for an update. */
    val uuid: String? = null,
) {
    init {
        val problems = ExerciseRules.problems(
            name, description, category, instructions, tips, commonMistakes, equipment, difficulty,
        )
        require(problems.isEmpty()) { "Invalid exercise: $problems" }
    }
}

/**
 * The custom exercise form's rules, the same the server enforces on create and update
 * (`exercise-info.ts`; the step limits are `STEP_LIST_*` in `@trackbit/types`).
 */
object ExerciseRules {
    val NAME_LENGTH = 1..100
    const val DESCRIPTION_MAX = 500

    /** Instructions, tips and common mistakes each hold at most this many entries… */
    const val STEPS_MAX = 20

    /** …of at most this many characters, trimmed. */
    const val STEP_LENGTH_MAX = 300

    enum class Problem { NameLength, DescriptionLength, Category, Instructions, Tips, CommonMistakes, Equipment, Difficulty }

    /** A step list as the server stores it: trimmed, blank entries dropped, null when none is left. */
    fun steps(entries: List<String>?): List<String>? =
        entries.orEmpty().map { it.trim() }.filter { it.isNotEmpty() }.ifEmpty { null }

    /** Everything wrong with these values; empty when the server would accept them. */
    fun problems(
        name: String,
        description: String?,
        category: ExerciseCategory,
        instructions: List<String>? = null,
        tips: List<String>? = null,
        commonMistakes: List<String>? = null,
        equipment: List<ExerciseEquipment> = emptyList(),
        difficulty: ExerciseDifficulty? = null,
    ): Set<Problem> = buildSet {
        if (name.trim().length !in NAME_LENGTH) add(Problem.NameLength)
        if ((description?.trim()?.length ?: 0) > DESCRIPTION_MAX) add(Problem.DescriptionLength)
        if (category == ExerciseCategory.Unknown) add(Problem.Category)
        if (!stepsValid(instructions)) add(Problem.Instructions)
        if (!stepsValid(tips)) add(Problem.Tips)
        if (!stepsValid(commonMistakes)) add(Problem.CommonMistakes)
        if (ExerciseEquipment.Unknown in equipment) add(Problem.Equipment)
        if (difficulty == ExerciseDifficulty.Unknown) add(Problem.Difficulty)
    }

    /** Blank entries count toward [STEPS_MAX], as on the server, which drops them only afterwards. */
    private fun stepsValid(entries: List<String>?) =
        entries == null || (entries.size <= STEPS_MAX && entries.all { it.trim().length <= STEP_LENGTH_MAX })
}
