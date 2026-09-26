package com.trackbit.core.model

/** What [Streak] and [HabitProgress] need to know about a habit. */
interface TrackableHabit {
    val type: HabitType
    val isAntiHabit: Boolean

    /** At least 1 (enforced by the database). Minutes for [HabitType.Timed], a count otherwise. */
    val dailyGoal: Int
}
