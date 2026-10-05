package com.trackbit.feature.exerciselists

import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseListRules.Target
import com.trackbit.core.model.Prescription
import com.trackbit.core.model.UnitSystem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class TargetsFormTest {
    private val prescribed = Prescription(3, 8, 60.0, 90, 1.5, 120, "Pause")

    @Test fun `a prescription round-trips through the form`() {
        val form = TargetsForm.of(prescribed, UnitSystem.Metric)
        assertEquals("1", form.durationMinutes)
        assertEquals("30", form.durationSeconds)
        assertEquals("2", form.restMinutes)
        assertEquals("0", form.restSeconds)
        assertEquals(prescribed, form.prescription)
    }

    @Test fun `pounds are stored as kilograms, and an untouched weight is kept exactly`() {
        val form = TargetsForm.of(prescribed, UnitSystem.Imperial)
        assertEquals("132.5", form.weight)
        assertEquals(60.0, form.prescription?.targetWeight)

        assertEquals(45.36, form.copy(weight = "100").prescription?.targetWeight)
        assertEquals(45.36, form.copy(weight = "100,0").prescription?.targetWeight)
    }

    @Test fun `blank fields are not prescribed, and rest may be zero`() {
        val form = TargetsForm(restMinutes = "0", restSeconds = "", notes = "  ")
        assertEquals(Prescription.NONE.copy(restSeconds = 0), form.prescription)
        assertEquals(Prescription.NONE, TargetsForm.of(prescribed, UnitSystem.Metric).cleared().prescription)
    }

    @Test fun `out of range or malformed targets are problems`() {
        val form = TargetsForm(sets = "0", reps = "1001", weight = "1.2.3", durationMinutes = "1441", distance = "0", restMinutes = "61")
        assertEquals(setOf(Target.Sets, Target.Reps, Target.Weight, Target.Duration, Target.Distance, Target.Rest), form.problems)
        assertNull(form.prescription)
    }

    @Test fun `each category shows what its sets record`() {
        assertEquals(listOf(Target.Sets, Target.Reps, Target.Weight, Target.Rest, Target.Notes), targetsFor(ExerciseCategory.Strength))
        assertEquals(listOf(Target.Sets, Target.Distance, Target.Duration, Target.Rest, Target.Notes), targetsFor(ExerciseCategory.Cardio))
        assertEquals(listOf(Target.Sets, Target.Duration, Target.Rest, Target.Notes), targetsFor(ExerciseCategory.Flexibility))
    }
}
