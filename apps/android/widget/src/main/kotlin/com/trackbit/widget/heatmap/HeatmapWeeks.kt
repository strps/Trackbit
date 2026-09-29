package com.trackbit.widget.heatmap

import com.trackbit.core.model.RecentDay
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.time.temporal.TemporalAdjusters

/**
 * The days W3 reads: [MAX_WEEKS] calendar weeks ending with today's. Fixed, whatever the widget's
 * size, so every instance asks for the same history; a smaller widget shows only the latest weeks.
 */
internal class HeatmapWindow(val today: LocalDate, val firstDayOfWeek: DayOfWeek) {
    /** The first day of today's week. */
    private val thisWeek: LocalDate = today.with(TemporalAdjusters.previousOrSame(firstDayOfWeek))

    val start: LocalDate = thisWeek.minusWeeks(MAX_WEEKS - 1L)

    /** How many days from [start] to [today], both included. */
    val days: Int = ChronoUnit.DAYS.between(start, today).toInt() + 1

    /**
     * The last [count] weeks (at most [MAX_WEEKS]), oldest first, each from [firstDayOfWeek] on.
     * [recent] are the habit's days ending at [today]; days after today are null, and days
     * [recent] doesn't reach are empty.
     */
    fun weeks(recent: List<RecentDay>, count: Int): List<List<RecentDay?>> {
        val byDay = recent.associateBy { it.day }
        val first = thisWeek.minusWeeks(count.coerceIn(1, MAX_WEEKS) - 1L)
        return (0 until count.coerceIn(1, MAX_WEEKS)).map { week ->
            (0 until DAYS_PER_WEEK).map { offset ->
                val day = first.plusWeeks(week.toLong()).plusDays(offset.toLong())
                if (day.isAfter(today)) null else byDay[day] ?: RecentDay(day, rating = null, sessionCount = 0)
            }
        }
    }

    companion object {
        /** About six months: what fits a 4-cell-wide widget at its smallest cells. */
        const val MAX_WEEKS = 26
        const val DAYS_PER_WEEK = 7
    }
}
