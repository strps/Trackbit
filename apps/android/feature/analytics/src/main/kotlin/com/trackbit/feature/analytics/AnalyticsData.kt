package com.trackbit.feature.analytics

import com.trackbit.core.designsystem.format.round
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.HabitSet
import com.trackbit.core.model.MuscleGroupRef
import com.trackbit.core.model.RecentDay
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters
import kotlin.math.roundToInt

// The web's analytics hooks (`use-analytics`, `use-exercise-chart`, `use-volume-chart`,
// `use-muscle-chart`) as pure functions, so both apps show the same numbers. Weights stay in
// kilograms here; only the UI converts them.

/** The charts' time range: days after [today] minus the span count. */
internal enum class TimeRange {
    OneMonth, ThreeMonths, SixMonths, OneYear, All;

    /** Whether [day] is in range, seen from [today]. */
    fun includes(day: LocalDate, today: LocalDate): Boolean = when (this) {
        OneMonth -> day.isAfter(today.minusMonths(1))
        ThreeMonths -> day.isAfter(today.minusMonths(3))
        SixMonths -> day.isAfter(today.minusMonths(6))
        OneYear -> day.isAfter(today.minusYears(1))
        All -> true
    }

    companion object {
        /** What every chart starts with, as on the web. */
        val DEFAULT = ThreeMonths
    }
}

// --- Stat cards ---

/** The cards above the heatmap. [currentStreak] is null when the logs can't tell. */
data class HabitStats(val totalCompletions: Int, val currentStreak: Int?, val goalFrequencyPercent: Int)

/**
 * [recent]: the habit's days up to [today], reaching back at least to its first log. A day counts
 * as a completion when it has a log at all, as on the web; the goal frequency spreads those over
 * the days since the first one.
 */
internal fun habitStats(recent: List<RecentDay>, streak: Int?, today: LocalDate): HabitStats {
    val logged = recent.filter { it.rating != null || it.sessionCount > 0 }
    val first = logged.minOfOrNull { it.day }
    val frequency = if (first == null) 0 else {
        val days = ChronoUnit.DAYS.between(first, today) + 1
        if (days > 0) (logged.size * 100.0 / days).roundToInt() else 0
    }
    return HabitStats(logged.size, streak, frequency)
}

// --- Exercise progression ---

internal enum class ExerciseMetric { MaxWeight, TotalVolume, EstimatedOneRm, AvgRpe }

/** One day of an exercise. [value] is in kilograms except for [ExerciseMetric.AvgRpe]. */
internal data class ExercisePoint(val day: LocalDate, val value: Double, val isPr: Boolean)

/** [best] is the highest value in range (the last PR), null without points. */
internal data class ExerciseSeries(val points: List<ExercisePoint>) {
    val prCount: Int get() = points.count { it.isPr }
    val best: Double? get() = points.lastOrNull { it.isPr }?.value
}

/** Epley: weight × (1 + reps / 30). */
private fun epley(weight: Double, reps: Int): Double = weight * (1 + reps / 30.0)

/**
 * [exerciseId]'s value per day in [range], to one decimal. A point is a PR when it beats every
 * earlier one in range. Days without the metric's data (no weights, no RPE) are skipped.
 */
internal fun exerciseSeries(
    sets: List<HabitSet>,
    exerciseId: Int,
    metric: ExerciseMetric,
    range: TimeRange,
    today: LocalDate,
): ExerciseSeries {
    val byDay = sets.filter { it.exerciseId == exerciseId && range.includes(it.day, today) }.groupBy { it.day }
    var runningMax = Double.NEGATIVE_INFINITY
    val points = byDay.keys.sorted().mapNotNull { day ->
        val daySets = byDay.getValue(day)
        val value = when (metric) {
            ExerciseMetric.MaxWeight -> daySets.mapNotNull { it.weight }.maxOrNull()
            ExerciseMetric.TotalVolume -> daySets.sumOf { s -> if (s.weight != null && s.reps != null) s.weight!! * s.reps!! else 0.0 }
                .takeIf { it != 0.0 }
            ExerciseMetric.EstimatedOneRm -> daySets
                .filter { it.weight != null && it.reps != null && it.reps!! > 0 }
                .maxOfOrNull { epley(it.weight!!, it.reps!!) }
            ExerciseMetric.AvgRpe -> daySets.mapNotNull { it.rpe }.takeIf { it.isNotEmpty() }?.average()
        } ?: return@mapNotNull null
        val rounded = round(value, 1)
        val isPr = rounded > runningMax
        if (isPr) runningMax = rounded
        ExercisePoint(day, rounded, isPr)
    }
    return ExerciseSeries(points)
}

/** The exercises [sets] use, in the catalog's order; ids missing from the catalog are left out. */
internal fun usedExercises(sets: List<HabitSet>, catalog: List<Exercise>): List<Exercise> {
    val used = sets.mapTo(HashSet()) { it.exerciseId }
    return catalog.filter { it.id in used }
}

// --- Weekly volume ---

/** One ISO week (from Monday): volume (weight × reps, kg) in total and per exercise. */
internal data class WeekVolume(
    val weekStart: LocalDate,
    val total: Double,
    val byExercise: Map<Int, Double>,
    /** The week's average RPE over the sets that have one, to one decimal. */
    val avgRpe: Double?,
)

/** [exerciseIds] are those with volume in range, ascending: the stacked bars' order. */
internal data class VolumeData(val weeks: List<WeekVolume>, val exerciseIds: List<Int>) {
    val totalVolume: Double get() = weeks.sumOf { it.total }

    /** The mean of the weekly averages, to one decimal. */
    val avgRpe: Double? get() = weeks.mapNotNull { it.avgRpe }.takeIf { it.isNotEmpty() }?.let { round(it.average(), 1) }

    /** The first week with the highest total. */
    val peakWeek: WeekVolume? get() = weeks.fold(null as WeekVolume?) { best, w -> if (best == null || w.total > best.total) w else best }
}

/** Sets with both weight and reps in [range], by ISO week; totals rounded to whole kilograms. */
internal fun weeklyVolume(sets: List<HabitSet>, range: TimeRange, today: LocalDate): VolumeData {
    val counted = sets.filter { it.weight != null && it.reps != null && range.includes(it.day, today) }
    val weeks = counted.groupBy { it.day.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)) }
        .toSortedMap()
        .map { (weekStart, weekSets) ->
            val rpes = weekSets.mapNotNull { it.rpe }
            WeekVolume(
                weekStart = weekStart,
                total = weekSets.sumOf { it.weight!! * it.reps!! }.roundToInt().toDouble(),
                byExercise = weekSets.groupBy { it.exerciseId }
                    .mapValues { (_, s) -> s.sumOf { it.weight!! * it.reps!! }.roundToInt().toDouble() },
                avgRpe = rpes.takeIf { it.isNotEmpty() }?.let { round(it.average(), 1) },
            )
        }
    return VolumeData(weeks, counted.map { it.exerciseId }.distinct().sorted())
}

// --- Muscle balance ---

internal enum class MuscleMetric { Volume, Frequency }

internal data class MuscleValue(val group: MuscleGroupRef, val value: Double)

/** Most trained first (ties by name). Empty when no set in range has an exercise with muscle groups. */
internal data class MuscleBalance(val values: List<MuscleValue>) {
    val top: MuscleValue? get() = values.firstOrNull()
    val least: MuscleValue? get() = values.lastOrNull()
}

/**
 * Per muscle group of the sets' exercises in [range]: volume (weight × reps, kg, rounded), or
 * frequency (each exercise counted once per day). A set counts fully for each of its groups.
 */
internal fun muscleBalance(
    sets: List<HabitSet>,
    catalog: List<Exercise>,
    metric: MuscleMetric,
    range: TimeRange,
    today: LocalDate,
): MuscleBalance {
    val groupsOf = catalog.associate { it.id to it.muscleGroups }
    val volume = HashMap<MuscleGroupRef, Double>()
    val frequency = HashMap<MuscleGroupRef, Int>()
    val seen = HashSet<Triple<LocalDate, Int, Int>>()
    for (set in sets) {
        if (!range.includes(set.day, today)) continue
        for (group in groupsOf[set.exerciseId].orEmpty()) {
            if (set.weight != null && set.reps != null) volume.merge(group, set.weight!! * set.reps!!, Double::plus)
            if (seen.add(Triple(set.day, set.exerciseId, group.id))) frequency.merge(group, 1, Int::plus)
        }
    }
    val values = when (metric) {
        MuscleMetric.Volume -> volume.map { (group, v) -> MuscleValue(group, v.roundToInt().toDouble()) }
        MuscleMetric.Frequency -> frequency.map { (group, n) -> MuscleValue(group, n.toDouble()) }
    }
    return MuscleBalance(values.sortedWith(compareByDescending<MuscleValue> { it.value }.thenBy { it.group.name }))
}
