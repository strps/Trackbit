package com.trackbit.core.model

import com.trackbit.core.model.HabitRules.Problem
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class HabitRulesTest {
    private fun problems(
        name: String = "Read",
        type: HabitType = HabitType.Count,
        isAntiHabit: Boolean = false,
        weeklyGoal: Int = 5,
        dailyGoal: Int = 3,
        colorStops: List<ColorStop> = GradientPresets.getValue(ColorTheme.Custom),
    ) = HabitRules.problems(name, type, isAntiHabit, weeklyGoal, dailyGoal, colorStops)

    @Test fun `names are 3 to 50 characters once trimmed`() {
        assertEquals(emptySet<Problem>(), problems(name = "  Run  "))
        assertEquals(setOf(Problem.NameLength), problems(name = " Go "))
        assertEquals(setOf(Problem.NameLength), problems(name = "x".repeat(51)))
    }

    @Test fun `goals follow the type`() {
        assertEquals(setOf(Problem.DailyGoal), problems(dailyGoal = 101))
        assertEquals(emptySet<Problem>(), problems(type = HabitType.Timed, dailyGoal = 1440))
        assertEquals(setOf(Problem.DailyGoal), problems(type = HabitType.Timed, dailyGoal = 1441))
        assertEquals(setOf(Problem.WeeklyGoal), problems(weeklyGoal = 8))
        assertEquals(setOf(Problem.DailyGoal), problems(dailyGoal = 0))
    }

    @Test fun `structured sessions can't be anti-habits`() {
        assertEquals(setOf(Problem.AntiHabitType), problems(type = HabitType.Complex, isAntiHabit = true))
        assertEquals(emptySet<Problem>(), problems(type = HabitType.Check, isAntiHabit = true))
    }

    @Test fun `a request can't be built with problems`() {
        assertThrows(IllegalArgumentException::class.java) {
            HabitRequest("Gym", HabitType.Complex, true, 5, 1, ColorTheme.Blue, GradientPresets.getValue(ColorTheme.Blue), HabitIcon.Dumbbell)
        }
    }
}
