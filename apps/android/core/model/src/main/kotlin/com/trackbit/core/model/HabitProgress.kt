package com.trackbit.core.model

/** Badge states, matching the web's `ProgressBadge`. */
enum class ProgressState { NotStarted, Started, Halfway, Done, Avoided, Slipped }

/**
 * A habit's progress toward its daily goal for one day.
 *
 * [value] and [goal] share a unit: milliseconds for timed habits (whose goal is stored in
 * minutes), sessions for complex habits, 0/1 for check habits and a count otherwise.
 */
data class HabitProgress(
    val value: Long,
    val goal: Long,
    val isAntiHabit: Boolean,
) {
    /** How far toward [goal], clamped to 0..1 for display. */
    val fraction: Float get() = (value.toFloat() / goal).coerceIn(0f, 1f)

    val isGoalMet: Boolean get() = value >= goal

    val state: ProgressState
        get() = when {
            isAntiHabit -> if (fraction <= 0f) ProgressState.Avoided else ProgressState.Slipped
            fraction <= 0f -> ProgressState.NotStarted
            fraction >= 1f -> ProgressState.Done
            fraction >= 0.5f -> ProgressState.Halfway
            else -> ProgressState.Started
        }

    companion object {
        private const val MS_PER_MINUTE = 60_000L

        fun of(habit: TrackableHabit, rating: Int?, sessionCount: Int): HabitProgress {
            val r = (rating ?: 0).toLong()
            val (value, goal) = when (habit.type) {
                HabitType.Timed -> r to habit.dailyGoal * MS_PER_MINUTE
                HabitType.Check -> (if (r > 0) 1L else 0L) to 1L
                HabitType.Complex -> sessionCount.toLong() to 1L
                HabitType.Count, HabitType.Negative, HabitType.Unknown -> r to habit.dailyGoal.toLong()
            }
            return HabitProgress(value, goal, habit.isAntiHabit)
        }
    }
}
