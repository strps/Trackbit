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
     * The streak ending the day before [day], or null when it can't be known without a sync.
     *
     * The server's [streakBeforeDay] is only valid for [summaryDay]. For a later [day] (after
     * midnight, before the next sync) the days from [summaryDay] up to [day] are judged on [logs],
     * which must hold every known log from [summaryDay] on. For an earlier [day] it is unknown.
     */
    fun beforeDay(
        habit: TrackableHabit,
        logs: Map<LocalDate, StreakDay>,
        day: LocalDate,
        firstLogDay: LocalDate?,
        summaryDay: LocalDate,
        streakBeforeDay: Int,
    ): Int? {
        if (day.isBefore(summaryDay)) return null
        var bridged = 0
        var cursor = day.minusDays(1)
        while (!cursor.isBefore(summaryDay)) {
            if (!dayCounts(habit, logs[cursor], cursor, firstLogDay)) return bridged
            bridged++
            cursor = cursor.minusDays(1)
        }
        return minOf(streakBeforeDay + bridged, MAX_DAYS)
    }

    /**
     * The streak ending at (and including) [day], a day before [summaryDay], or null when the
     * logs can't tell. [logs] must hold every log from [knownFrom] up to [summaryDay].
     *
     * Walking back from [day] gives it whenever the walk ends on a known day (or before the first
     * log, where nothing counts). Otherwise, when every day from [day] up to [summaryDay] counts,
     * it is the server's [streakBeforeDay] less the days after [day].
     */
    fun endingBefore(
        habit: TrackableHabit,
        logs: Map<LocalDate, StreakDay>,
        day: LocalDate,
        firstLogDay: LocalDate?,
        knownFrom: LocalDate,
        summaryDay: LocalDate,
        streakBeforeDay: Int,
    ): Int? {
        require(day.isBefore(summaryDay)) { "day must be before the summary day" }
        val walked = endingAt(habit, logs, day, firstLogDay)
        val stop = day.minusDays(walked.toLong())
        val countedKnown = walked == 0 || !stop.plusDays(1).isBefore(knownFrom)
        val stopKnown = walked == MAX_DAYS || !stop.isBefore(knownFrom) || firstLogDay == null || stop.isBefore(firstLogDay)
        if (countedKnown && stopKnown) return walked

        // A capped server streak may hide days further back.
        if (day.isBefore(knownFrom) || streakBeforeDay >= MAX_DAYS) return null
        var cursor = day
        while (cursor.isBefore(summaryDay)) {
            if (!dayCounts(habit, logs[cursor], cursor, firstLogDay)) return null
            cursor = cursor.plusDays(1)
        }
        val after = summaryDay.toEpochDay() - 1 - day.toEpochDay()
        // Below 1 only if local writes contradict the server's streak; then it can't be told.
        return (streakBeforeDay - after).toInt().takeIf { it >= 1 }
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
