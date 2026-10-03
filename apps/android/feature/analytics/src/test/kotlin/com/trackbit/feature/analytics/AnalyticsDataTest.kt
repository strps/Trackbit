package com.trackbit.feature.analytics

import com.trackbit.core.model.Exercise
import com.trackbit.core.model.HabitSet
import com.trackbit.core.model.MuscleGroupRef
import com.trackbit.core.model.RecentDay
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

/** The web's analytics math, ported: same inputs, same numbers. */
class AnalyticsDataTest {
    private val today = LocalDate.of(2026, 10, 3) // a Saturday

    private fun set(daysAgo: Long, exerciseId: Int = 1, weight: Double? = 50.0, reps: Int? = 5, rpe: Int? = null) =
        HabitSet(today.minusDays(daysAgo), exerciseId, weight, reps, rpe, duration = null, distance = null)

    @Test fun `ranges keep days strictly after the cutoff`() {
        assertTrue(TimeRange.OneMonth.includes(LocalDate.of(2026, 9, 4), today))
        assertFalse(TimeRange.OneMonth.includes(LocalDate.of(2026, 9, 3), today))
        assertFalse(TimeRange.OneYear.includes(LocalDate.of(2025, 10, 3), today))
        assertTrue(TimeRange.All.includes(LocalDate.of(2000, 1, 1), today))
    }

    @Test fun `stats count logged days and spread them over the days since the first`() {
        val recent = (9L downTo 0L).map { daysAgo ->
            val day = today.minusDays(daysAgo)
            when (daysAgo) {
                9L -> RecentDay(day, rating = 0, sessionCount = 0) // a log, even at 0
                4L -> RecentDay(day, rating = null, sessionCount = 2)
                0L -> RecentDay(day, rating = 3, sessionCount = 0)
                else -> RecentDay(day, rating = null, sessionCount = 0)
            }
        }
        assertEquals(HabitStats(totalCompletions = 3, currentStreak = 1, goalFrequencyPercent = 30), habitStats(recent, 1, today))
        assertEquals(HabitStats(0, null, 0), habitStats(listOf(RecentDay(today, null, 0)), null, today))
    }

    @Test fun `max weight per day marks each new best as a PR`() {
        val sets = listOf(
            set(20, weight = 50.0), set(20, weight = 55.0),
            set(10, weight = 52.5),
            set(5, weight = 57.5),
            set(3, exerciseId = 2, weight = 100.0),
            set(1, weight = null, reps = 10), // no weight: no point
        )
        val series = exerciseSeries(sets, 1, ExerciseMetric.MaxWeight, TimeRange.ThreeMonths, today)
        assertEquals(
            listOf(
                ExercisePoint(today.minusDays(20), 55.0, isPr = true),
                ExercisePoint(today.minusDays(10), 52.5, isPr = false),
                ExercisePoint(today.minusDays(5), 57.5, isPr = true),
            ),
            series.points,
        )
        assertEquals(2, series.prCount)
        assertEquals(57.5, series.best!!, 0.0)
    }

    @Test fun `volume, estimated 1RM and RPE per day, to one decimal`() {
        val sets = listOf(set(2, weight = 60.0, reps = 8, rpe = 7), set(2, weight = 62.5, reps = 6, rpe = 8), set(2, weight = 70.0, reps = 0))
        fun value(metric: ExerciseMetric) = exerciseSeries(sets, 1, metric, TimeRange.All, today).points.single().value
        assertEquals(855.0, value(ExerciseMetric.TotalVolume), 0.0)
        assertEquals("Epley, ignoring sets of 0 reps", 76.0, value(ExerciseMetric.EstimatedOneRm), 0.0)
        assertEquals(7.5, value(ExerciseMetric.AvgRpe), 0.0)
        assertTrue(exerciseSeries(sets, 1, ExerciseMetric.MaxWeight, TimeRange.OneMonth, today.plusMonths(2)).points.isEmpty())
    }

    @Test fun `weekly volume groups by ISO week, per exercise, with the week's RPE`() {
        val sets = listOf(
            set(12, weight = 50.0, reps = 10, rpe = 6), // Mon 21 Sep
            set(6, exerciseId = 2, weight = 100.0, reps = 5, rpe = 9), // Sun 27 Sep, same week
            set(5, weight = 40.0, reps = 10), // Mon 28 Sep
            set(5, weight = null, reps = 10), // not volume
        )
        val volume = weeklyVolume(sets, TimeRange.All, today)
        assertEquals(listOf(LocalDate.of(2026, 9, 21), LocalDate.of(2026, 9, 28)), volume.weeks.map { it.weekStart })
        assertEquals(mapOf(1 to 500.0, 2 to 500.0), volume.weeks[0].byExercise)
        assertEquals(1000.0, volume.weeks[0].total, 0.0)
        assertEquals(7.5, volume.weeks[0].avgRpe!!, 0.0)
        assertNull(volume.weeks[1].avgRpe)
        assertEquals(listOf(1, 2), volume.exerciseIds)
        assertEquals(1400.0, volume.totalVolume, 0.0)
        assertEquals(7.5, volume.avgRpe!!, 0.0)
        assertEquals(LocalDate.of(2026, 9, 21), volume.peakWeek!!.weekStart)
    }

    @Test fun `muscle balance counts volume per group and frequency once per exercise and day`() {
        val chest = MuscleGroupRef(1, "Chest")
        val triceps = MuscleGroupRef(2, "Triceps")
        val back = MuscleGroupRef(3, "Back")
        val catalog = listOf(exercise(1, chest, triceps), exercise(2, back), exercise(3))
        val sets = listOf(
            set(2, exerciseId = 1, weight = 50.0, reps = 10), set(2, exerciseId = 1, weight = 50.0, reps = 10),
            set(1, exerciseId = 2, weight = 100.0, reps = 5),
            set(1, exerciseId = 2, weight = null, reps = 12),
            set(1, exerciseId = 3, weight = 10.0, reps = 10), // no groups
        )
        val volume = muscleBalance(sets, catalog, MuscleMetric.Volume, TimeRange.All, today)
        assertEquals(listOf(chest to 1000.0, triceps to 1000.0, back to 500.0), volume.values.map { it.group to it.value })
        assertEquals(chest, volume.top!!.group)
        assertEquals(back, volume.least!!.group)

        val frequency = muscleBalance(sets, catalog, MuscleMetric.Frequency, TimeRange.All, today)
        assertEquals(listOf(back to 1.0, chest to 1.0, triceps to 1.0), frequency.values.map { it.group to it.value })
        assertTrue(muscleBalance(sets, listOf(exercise(1)), MuscleMetric.Volume, TimeRange.All, today).values.isEmpty())
    }

    @Test fun `the exercise picker offers only exercises with sets, in catalog order`() {
        val catalog = listOf(exercise(3), exercise(1), exercise(2))
        assertEquals(listOf(3, 1), usedExercises(listOf(set(1, exerciseId = 1), set(1, exerciseId = 3), set(1, exerciseId = 9)), catalog).map { it.id })
    }

    private fun exercise(id: Int, vararg groups: MuscleGroupRef) = Exercise(
        id = id, userId = null, name = "Exercise $id", category = "strength",
        defaultWeightUnit = null, defaultDistanceUnit = null, lastPerformance = null, muscleGroups = groups.toList(),
    )
}
