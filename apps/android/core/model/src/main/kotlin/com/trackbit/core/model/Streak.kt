package com.trackbit.core.model

import java.time.LocalDate

/** A day's tracking as far as streaks care. */
data class StreakDay(val rating: Int?, val sessionCount: Int)

/**
 * Streak rules, ported from the backend's `lib/streak.ts` (which mirrors the web's
 * `computeStreak`). Keep all three in step.
 */
object Streak {
    const val MAX_DAYS = 365

    /** Whether [day] extends the streak, given that day's [log] (null when nothing was logged). */
    fun dayCounts(habit: TrackableHabit, log: StreakDay?, day: LocalDate, firstLogDay: LocalDate?): Boolean {
        if (habit.isAntiHabit) {
            // An anti-habit streak can't reach back before tracking started.
            if (firstLogDay == null || day.isBefore(firstLogDay)) return false
            return log == null || (log.rating ?: 0) == 0
        }
        return if (habit.type == HabitType.Complex) {
            (log?.sessionCount ?: 0) > 0
        } else {
            (log?.rating ?: 0) > 0
        }
    }

    /** Consecutive counting days ending at (and including) [fromDay], capped at [MAX_DAYS]. */
    fun endingAt(habit: TrackableHabit, logs: Map<LocalDate, StreakDay>, fromDay: LocalDate, firstLogDay: LocalDate?): Int {
        var streak = 0
        var cursor = fromDay
        while (streak < MAX_DAYS && dayCounts(habit, logs[cursor], cursor, firstLogDay)) {
            streak++
            cursor = cursor.minusDays(1)
        }
        return streak
    }

    /**
     * The streak to display for [day]: the server's [streakBeforeDay] plus [day] itself, judged
     * on the local (possibly optimistic) [log] so a tap updates the streak before any sync.
     */
    fun current(
        habit: TrackableHabit,
        log: StreakDay?,
        day: LocalDate,
        firstLogDay: LocalDate?,
        streakBeforeDay: Int,
    ): Int = if (dayCounts(habit, log, day, firstLogDay)) streakBeforeDay + 1 else 0
}
