package com.trackbit.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

/** Mirrors apps/backend/test/streak.test.ts, plus [Streak.beforeDay], [Streak.endingBefore] and [Streak.current]. */
class StreakTest {
    private val regular = TestHabit(HabitType.Count)
    private val complex = TestHabit(HabitType.Complex)
    private val anti = TestHabit(HabitType.Count, isAntiHabit = true)

    private fun logs(vararg entries: Pair<String, StreakDay>) = entries.associate { (d, v) -> day(d) to v }
    private fun rated(rating: Int) = StreakDay(rating, 0)
    private fun sessions(count: Int) = StreakDay(null, count)

    @Test fun `counts consecutive rated days and stops at a gap`() {
        val l = logs("2026-01-10" to rated(1), "2026-01-09" to rated(3), "2026-01-07" to rated(1))
        assertEquals(2, Streak.endingAt(regular, l, day("2026-01-10"), day("2026-01-07")))
    }

    @Test fun `is 0 when the start day is not done`() {
        val l = logs("2026-01-09" to rated(1))
        assertEquals(0, Streak.endingAt(regular, l, day("2026-01-10"), day("2026-01-09")))
    }

    @Test fun `treats rating 0 as not done`() {
        assertEquals(0, Streak.endingAt(regular, logs("2026-01-10" to rated(0)), day("2026-01-10"), day("2026-01-10")))
    }

    @Test fun `uses sessions, not rating, for complex habits`() {
        val l = logs("2026-01-10" to sessions(1), "2026-01-09" to rated(5))
        assertEquals(1, Streak.endingAt(complex, l, day("2026-01-10"), day("2026-01-09")))
    }

    @Test fun `counts avoided days for anti-habits back to the first log`() {
        val l = logs("2026-01-06" to rated(0), "2026-01-08" to rated(0))
        // 01-10, 01-09 (no log), 01-08 (0), 01-07 (no log), 01-06 (first log) → 5
        assertEquals(5, Streak.endingAt(anti, l, day("2026-01-10"), day("2026-01-06")))
    }

    @Test fun `breaks an anti-habit streak on a slip`() {
        val l = logs("2026-01-06" to rated(0), "2026-01-08" to rated(2))
        assertEquals(2, Streak.endingAt(anti, l, day("2026-01-10"), day("2026-01-06")))
    }

    @Test fun `is 0 for an anti-habit that was never logged`() {
        assertEquals(0, Streak.endingAt(anti, emptyMap(), day("2026-01-10"), null))
    }

    @Test fun `caps at a year`() {
        assertEquals(365, Streak.endingAt(anti, emptyMap(), day("2026-01-10"), day("2020-01-01")))
    }

    @Test fun `current adds today when today counts`() {
        assertEquals(4, Streak.current(regular, rated(1), day("2026-01-10"), day("2026-01-01"), streakBeforeDay = 3))
    }

    @Test fun `current is 0 when today does not count yet`() {
        assertEquals(0, Streak.current(regular, null, day("2026-01-10"), day("2026-01-01"), streakBeforeDay = 3))
        assertEquals(0, Streak.current(regular, rated(0), day("2026-01-10"), day("2026-01-01"), streakBeforeDay = 3))
    }

    @Test fun `current follows an optimistic complex session`() {
        assertEquals(1, Streak.current(complex, sessions(1), day("2026-01-10"), day("2026-01-10"), streakBeforeDay = 0))
    }

    @Test fun `current counts an unlogged anti-habit day after the first log`() {
        assertEquals(6, Streak.current(anti, null, day("2026-01-10"), day("2026-01-01"), streakBeforeDay = 5))
    }

    @Test fun `current is 0 on an anti-habit slip or without a first log`() {
        assertEquals(0, Streak.current(anti, rated(1), day("2026-01-10"), day("2026-01-01"), streakBeforeDay = 5))
        assertEquals(0, Streak.current(anti, null, day("2026-01-10"), null, streakBeforeDay = 0))
    }

    @Test fun `beforeDay is the server's streak on the summary day`() {
        assertEquals(3, Streak.beforeDay(regular, emptyMap(), day("2026-01-10"), null, summaryDay = day("2026-01-10"), streakBeforeDay = 3))
    }

    @Test fun `beforeDay bridges the days since the summary with local logs`() {
        val l = logs("2026-01-10" to rated(1), "2026-01-11" to rated(2))
        assertEquals(5, Streak.beforeDay(regular, l, day("2026-01-12"), null, summaryDay = day("2026-01-10"), streakBeforeDay = 3))
    }

    @Test fun `beforeDay restarts at a gap after the summary`() {
        // 01-10 not done: the server's streak ended there; 01-11 alone counts.
        val l = logs("2026-01-11" to rated(1))
        assertEquals(1, Streak.beforeDay(regular, l, day("2026-01-12"), null, summaryDay = day("2026-01-10"), streakBeforeDay = 3))
        assertEquals(0, Streak.beforeDay(regular, emptyMap(), day("2026-01-12"), null, summaryDay = day("2026-01-10"), streakBeforeDay = 3))
    }

    @Test fun `beforeDay counts unlogged anti-habit days after the summary`() {
        assertEquals(7, Streak.beforeDay(anti, emptyMap(), day("2026-01-12"), day("2026-01-01"), summaryDay = day("2026-01-10"), streakBeforeDay = 5))
    }

    @Test fun `beforeDay is unknown for a day before the summary`() {
        assertEquals(null, Streak.beforeDay(regular, emptyMap(), day("2026-01-09"), null, summaryDay = day("2026-01-10"), streakBeforeDay = 3))
    }

    @Test fun `beforeDay caps at a year`() {
        assertEquals(365, Streak.beforeDay(anti, emptyMap(), day("2026-01-12"), day("2020-01-01"), summaryDay = day("2026-01-10"), streakBeforeDay = 365))
    }

    private fun ratedFrom(from: String, to: String) =
        generateSequence(day(from)) { it.plusDays(1) }.takeWhile { !it.isAfter(day(to)) }.associateWith { rated(1) }

    private fun endingBefore(
        habit: TrackableHabit,
        logs: Map<java.time.LocalDate, StreakDay>,
        on: String,
        firstLogDay: String?,
        knownFrom: String = "2026-01-04",
        streakBeforeDay: Int = 0,
    ) = Streak.endingBefore(habit, logs, day(on), firstLogDay?.let(::day), day(knownFrom), day("2026-01-10"), streakBeforeDay)

    @Test fun `endingBefore walks back to a known gap`() {
        assertEquals(2, endingBefore(regular, ratedFrom("2026-01-08", "2026-01-09"), "2026-01-09", "2025-12-01"))
        assertEquals(0, endingBefore(regular, ratedFrom("2026-01-08", "2026-01-09"), "2026-01-07", "2025-12-01"))
    }

    @Test fun `endingBefore stops at the first log, even before the known days`() {
        assertEquals(3, endingBefore(regular, ratedFrom("2026-01-07", "2026-01-09"), "2026-01-09", "2026-01-07", knownFrom = "2026-01-07"))
    }

    @Test fun `endingBefore counts back from the server's streak when the walk leaves the known days`() {
        val logs = ratedFrom("2026-01-04", "2026-01-09")
        assertEquals(20, endingBefore(regular, logs, "2026-01-09", "2025-12-01", streakBeforeDay = 20))
        assertEquals(18, endingBefore(regular, logs, "2026-01-07", "2025-12-01", streakBeforeDay = 20))
    }

    @Test fun `endingBefore counts unknown anti-habit days only through the server's streak`() {
        assertEquals(29, endingBefore(anti, emptyMap(), "2026-01-08", "2025-01-01", streakBeforeDay = 30))
        assertEquals(null, endingBefore(anti, emptyMap(), "2026-01-02", "2025-01-01", streakBeforeDay = 30))
        assertEquals("a capped streak", null, endingBefore(anti, emptyMap(), "2026-01-08", "2020-01-01", streakBeforeDay = 365))
    }

    @Test fun `endingBefore is unknown when a gap after the day breaks the server's streak`() {
        val logs = ratedFrom("2026-01-04", "2026-01-07") + ratedFrom("2026-01-09", "2026-01-09")
        assertEquals(null, endingBefore(regular, logs, "2026-01-07", "2025-12-01", streakBeforeDay = 1))
    }
}
