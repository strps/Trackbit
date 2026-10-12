package com.trackbit.core.model

import com.trackbit.core.model.ExerciseRules.Problem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

class ExerciseRulesTest {
    private fun problems(
        instructions: List<String>? = null,
        equipment: List<ExerciseEquipment> = emptyList(),
        difficulty: ExerciseDifficulty? = null,
    ) = ExerciseRules.problems("Dips", null, ExerciseCategory.Strength, instructions = instructions, equipment = equipment, difficulty = difficulty)

    @Test fun `steps are trimmed, blank ones dropped, and none left is null`() {
        assertEquals(listOf("Grip", "Dip"), ExerciseRules.steps(listOf(" Grip ", "", "  ", "Dip")))
        assertNull(ExerciseRules.steps(listOf(" ", "")))
        assertNull(ExerciseRules.steps(emptyList()))
        assertNull(ExerciseRules.steps(null))
    }

    @Test fun `at most 20 steps of at most 300 characters, trimmed`() {
        assertEquals(emptySet<Problem>(), problems(List(20) { "  ${"x".repeat(300)}  " }))
        assertEquals(setOf(Problem.Instructions), problems(List(21) { "Dip" }))
        assertEquals(setOf(Problem.Instructions), problems(listOf("x".repeat(301))))
    }

    @Test fun `tips and common mistakes follow the same rules`() {
        val tooMany = List(21) { "x" }
        assertEquals(
            setOf(Problem.Tips, Problem.CommonMistakes),
            ExerciseRules.problems("Dips", null, ExerciseCategory.Strength, tips = tooMany, commonMistakes = tooMany),
        )
    }

    @Test fun `equipment and difficulty must be known values`() {
        assertEquals(emptySet<Problem>(), problems(equipment = ExerciseEquipment.FORM, difficulty = ExerciseDifficulty.Advanced))
        assertEquals(setOf(Problem.Equipment, Problem.Difficulty), problems(equipment = listOf(ExerciseEquipment.Unknown), difficulty = ExerciseDifficulty.Unknown))
    }

    @Test fun `a request breaking a rule can't be built`() {
        assertThrows(IllegalArgumentException::class.java) {
            ExerciseRequest(
                "Dips", null, ExerciseCategory.Strength, emptyList(),
                instructions = List(21) { "Dip" }, tips = null, commonMistakes = null,
                equipment = emptyList(), difficulty = null, variantOfUuid = null,
            )
        }
    }

    @Test fun `unknown vocabulary decodes to Unknown`() {
        assertEquals(ExerciseEquipment.Unknown, ExerciseEquipment.of("hoverboard"))
        assertEquals(ExerciseEquipment.PullUpBar, ExerciseEquipment.of("pull_up_bar"))
        assertEquals(ExerciseDifficulty.Unknown, ExerciseDifficulty.of(null))
    }
}
