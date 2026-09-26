package com.trackbit.core.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HabitProgressTest {
    @Test fun `count divides the rating by the daily goal`() {
        val p = HabitProgress.of(TestHabit(HabitType.Count, dailyGoal = 4), rating = 1, sessionCount = 0)
        assertEquals(0.25f, p.fraction)
        assertEquals(ProgressState.Started, p.state)
        assertFalse(p.isGoalMet)
    }

    @Test fun `badge thresholds match the web`() {
        val habit = TestHabit(HabitType.Count, dailyGoal = 4)
        assertEquals(ProgressState.NotStarted, HabitProgress.of(habit, null, 0).state)
        assertEquals(ProgressState.Started, HabitProgress.of(habit, 1, 0).state)
        assertEquals(ProgressState.Halfway, HabitProgress.of(habit, 2, 0).state)
        assertEquals(ProgressState.Done, HabitProgress.of(habit, 4, 0).state)
    }

    @Test fun `going past the goal clamps the fraction but keeps the value`() {
        val p = HabitProgress.of(TestHabit(HabitType.Count, dailyGoal = 2), rating = 5, sessionCount = 0)
        assertEquals(1f, p.fraction)
        assertEquals(5L, p.value)
        assertTrue(p.isGoalMet)
    }

    @Test fun `timed ratings are milliseconds against a goal in minutes`() {
        val habit = TestHabit(HabitType.Timed, dailyGoal = 30)
        val half = HabitProgress.of(habit, rating = 15 * 60_000, sessionCount = 0)
        assertEquals(30 * 60_000L, half.goal)
        assertEquals(0.5f, half.fraction)
        assertEquals(ProgressState.Halfway, half.state)
        assertTrue(HabitProgress.of(habit, rating = 30 * 60_000, sessionCount = 0).isGoalMet)
    }

    @Test fun `check is done on any positive rating, whatever the goal`() {
        val habit = TestHabit(HabitType.Check, dailyGoal = 5)
        assertEquals(ProgressState.Done, HabitProgress.of(habit, 1, 0).state)
        assertEquals(ProgressState.NotStarted, HabitProgress.of(habit, 0, 0).state)
    }

    @Test fun `complex counts sessions, not rating`() {
        val habit = TestHabit(HabitType.Complex)
        assertEquals(ProgressState.Done, HabitProgress.of(habit, rating = null, sessionCount = 1).state)
        assertEquals(ProgressState.NotStarted, HabitProgress.of(habit, rating = 7, sessionCount = 0).state)
    }

    @Test fun `anti-habits are avoided at zero and slipped above it`() {
        val habit = TestHabit(HabitType.Count, isAntiHabit = true, dailyGoal = 3)
        assertEquals(ProgressState.Avoided, HabitProgress.of(habit, null, 0).state)
        assertEquals(ProgressState.Slipped, HabitProgress.of(habit, 1, 0).state)
    }

    @Test fun `unknown types are measured like counts`() {
        val p = HabitProgress.of(TestHabit(HabitType.Unknown, dailyGoal = 2), rating = 1, sessionCount = 0)
        assertEquals(0.5f, p.fraction)
    }
}
