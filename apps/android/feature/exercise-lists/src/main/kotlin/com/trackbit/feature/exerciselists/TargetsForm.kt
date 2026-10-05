package com.trackbit.feature.exerciselists

import com.trackbit.core.designsystem.format.displayToKg
import com.trackbit.core.designsystem.format.formatNumber
import com.trackbit.core.designsystem.format.kgToDisplay
import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseListRules
import com.trackbit.core.model.ExerciseListRules.Target
import com.trackbit.core.model.Prescription
import com.trackbit.core.model.UnitSystem

/**
 * An item's targets as the sheet edits them: text, with the weight in the user's unit and
 * durations as minutes and seconds. [prescription] turns them back into kg and seconds.
 */
data class TargetsForm(
    val sets: String = "",
    val reps: String = "",
    val weight: String = "",
    val distance: String = "",
    val durationMinutes: String = "",
    val durationSeconds: String = "",
    val restMinutes: String = "",
    val restSeconds: String = "",
    val notes: String = "",
    val units: UnitSystem = UnitSystem.Metric,
    /** The stored weight and how it first showed: unchanged, it's kept exactly (pounds round to a half). */
    private val initialWeightKg: Double? = null,
    private val initialWeight: String = "",
) {
    /** The targets the server would refuse, or that aren't numbers. */
    val problems: Set<Target>
        get() {
            val parsed = parse()
            return parsed.invalid + ExerciseListRules.problems(parsed.prescription)
        }

    /** Null while [problems] isn't empty. */
    val prescription: Prescription? get() = parse().takeIf { problems.isEmpty() }?.prescription

    private class Parsed(val prescription: Prescription, val invalid: Set<Target>)

    private fun parse(): Parsed {
        val invalid = mutableSetOf<Target>()
        fun int(text: String, target: Target): Int? =
            text.trim().takeIf { it.isNotEmpty() }?.let { it.toIntOrNull() ?: null.also { invalid += target } }
        fun decimal(text: String, target: Target): Double? =
            text.trim().takeIf { it.isNotEmpty() }?.let { it.replace(',', '.').toDoubleOrNull() ?: null.also { invalid += target } }
        fun seconds(minutes: String, seconds: String, target: Target): Int? {
            if (minutes.isBlank() && seconds.isBlank()) return null
            val m = int(minutes.ifBlank { "0" }, target) ?: return null
            val s = int(seconds.ifBlank { "0" }, target) ?: return null
            return m * 60 + s
        }
        val weightKg = if (weight == initialWeight) initialWeightKg else decimal(weight, Target.Weight)?.let { displayToKg(it, units) }
        return Parsed(
            Prescription(
                targetSets = int(sets, Target.Sets),
                targetReps = int(reps, Target.Reps),
                targetWeight = weightKg,
                targetDuration = seconds(durationMinutes, durationSeconds, Target.Duration),
                targetDistance = decimal(distance, Target.Distance),
                restSeconds = seconds(restMinutes, restSeconds, Target.Rest),
                notes = notes.trim().ifEmpty { null },
            ),
            invalid,
        )
    }

    /** Every target cleared. */
    fun cleared() = TargetsForm(units = units)

    companion object {
        fun of(p: Prescription, units: UnitSystem): TargetsForm {
            val weight = p.targetWeight?.let { formatNumber(kgToDisplay(it, units)) }.orEmpty()
            return TargetsForm(
                sets = p.targetSets?.toString().orEmpty(),
                reps = p.targetReps?.toString().orEmpty(),
                weight = weight,
                distance = p.targetDistance?.let(::formatNumber).orEmpty(),
                durationMinutes = p.targetDuration?.let { (it / 60).toString() }.orEmpty(),
                durationSeconds = p.targetDuration?.let { (it % 60).toString() }.orEmpty(),
                restMinutes = p.restSeconds?.let { (it / 60).toString() }.orEmpty(),
                restSeconds = p.restSeconds?.let { (it % 60).toString() }.orEmpty(),
                notes = p.notes.orEmpty(),
                units = units,
                initialWeightKg = p.targetWeight,
                initialWeight = weight,
            )
        }
    }
}

/**
 * The targets the sheet offers for [category]: what its sets record (as the session's set
 * controls show them), plus sets, rest and notes for all. Targets of other kinds are kept as they
 * are, only not shown.
 */
fun targetsFor(category: ExerciseCategory): List<Target> = when (category) {
    ExerciseCategory.Strength -> listOf(Target.Sets, Target.Reps, Target.Weight)
    ExerciseCategory.Cardio -> listOf(Target.Sets, Target.Distance, Target.Duration)
    ExerciseCategory.Flexibility -> listOf(Target.Sets, Target.Duration)
    ExerciseCategory.Unknown -> listOf(Target.Sets, Target.Reps, Target.Weight, Target.Distance, Target.Duration)
} + listOf(Target.Rest, Target.Notes)
