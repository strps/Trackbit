package com.trackbit.feature.session

import com.trackbit.core.data.TrackedSet
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.SetValues
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SessionFormatTest {
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
