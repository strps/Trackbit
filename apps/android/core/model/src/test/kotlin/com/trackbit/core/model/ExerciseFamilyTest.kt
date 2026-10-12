package com.trackbit.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

class ExerciseFamilyTest {
    private fun exercise(uuid: String, variantOf: String? = null) = Exercise(
        uuid = uuid,
        userId = null,
        name = uuid,
        category = "strength",
        defaultWeightUnit = null,
        defaultDistanceUnit = null,
        lastPerformance = null,
        variantOfUuid = variantOf,
    )

    private val bench = exercise("bench")
    private val incline = exercise("incline", variantOf = "bench")
    private val dumbbell = exercise("dumbbell", variantOf = "bench")
    private val squat = exercise("squat")
    private val catalog = listOf(incline, squat, bench, dumbbell)

    private fun List<Exercise>.uuids() = map { it.uuid }

    @Test fun `a base's family is its variants`() {
        assertEquals(listOf("incline", "dumbbell"), exerciseFamily(bench, catalog).uuids())
    }

    @Test fun `a variant's family is its base first, then its siblings`() {
        assertEquals(listOf("bench", "dumbbell"), exerciseFamily(incline, catalog).uuids())
    }

    @Test fun `an exercise with no family has none`() {
        assertEquals(emptyList<String>(), exerciseFamily(squat, catalog).uuids())
    }

    @Test fun `the siblings stay when the base isn't in the catalog`() {
        assertEquals(listOf("dumbbell"), exerciseFamily(incline, listOf(incline, dumbbell)).uuids())
    }

    @Test fun `a new exercise may be a variant of any base`() {
        assertEquals(listOf("squat", "bench"), variantOfCandidates(null, catalog).uuids())
    }

    @Test fun `a variant or a lone exercise may be a variant of any base but itself`() {
        assertEquals(listOf("squat", "bench"), variantOfCandidates(incline, catalog).uuids())
        assertEquals(listOf("bench"), variantOfCandidates(squat, catalog).uuids())
    }

    @Test fun `a base with variants can't become a variant`() {
        assertEquals(emptyList<String>(), variantOfCandidates(bench, catalog).uuids())
    }
}
