package com.trackbit.feature.session

import com.trackbit.core.data.TrackedSet
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.SetValues
import com.trackbit.core.model.UnitSystem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SessionFormatTest {
    @Test fun `weights show in the user's unit and go back in kilograms, like the web`() {
        assertEquals(60.0, kgToDisplay(60.0, UnitSystem.Metric), 0.0)
        assertEquals("to the nearest half pound", 132.5, kgToDisplay(60.0, UnitSystem.Imperial), 0.0)
        assertEquals(60.1, displayToKg(132.5, UnitSystem.Imperial), 0.0)
        assertEquals(62.5, displayToKg(62.5, UnitSystem.Metric), 0.0)
        assertEquals("lbs", weightUnit(UnitSystem.Imperial))
        assertEquals("kg", weightUnit(UnitSystem.Unknown))
    }

    @Test fun `numbers drop trailing zeros and steps don't drift`() {
        assertEquals("60", formatNumber(60.0))
        assertEquals("62.5", formatNumber(62.5))
        assertEquals(0.3, round(0.1 + 0.2, 2), 0.0)
    }

    @Test fun `the average RPE counts only sets that have one`() {
        assertNull(averageRpe(listOf(set(null))))
        assertEquals(8, averageRpe(listOf(set(7), set(null), set(8))))
    }

    @Test fun `the category picks the controls, and unknown ones log as strength`() {
        assertEquals(ExerciseKind.Cardio, ExerciseKind.of(exercise("cardio")))
        assertEquals(ExerciseKind.Flexibility, ExerciseKind.of(exercise("flexibility")))
        assertEquals(ExerciseKind.Strength, ExerciseKind.of(exercise("plyometrics")))
        assertEquals(ExerciseKind.Strength, ExerciseKind.of(null))
    }

    private fun set(rpe: Int?) = TrackedSet("p", 1, SetValues.EMPTY.copy(rpe = rpe))

    private fun exercise(category: String) = Exercise(
        id = 1, userId = null, name = "E", category = category,
        defaultWeightUnit = null, defaultDistanceUnit = null, lastPerformance = null,
    )
}
