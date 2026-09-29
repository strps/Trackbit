package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Embedded
import androidx.room.Query
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.database.entity.TimerEntity
import com.trackbit.core.model.RecentDay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.LocalDate

/**
 * A habit on one day, plus the days before it: what tracker rows and widgets render. A
 * projection of `habits`, `day_logs` and `timers`, never stored.
 */
data class HabitDay(
    val habit: HabitEntity,
    /** The days ending at the requested day ([RECENT_DAYS] by default), oldest first. Days without a log are empty. */
    val recent: List<RecentDay>,
    /** The habit's running timer, whichever day it logs to. */
    val timer: TimerEntity?,
) {
    /** The requested day. */
    val current: RecentDay get() = recent.last()

    companion object {
        /** Matches the server's `recent` window in `/api/tracker/today`. */
        const val RECENT_DAYS = 7
    }
}

@Dao
abstract class HabitDayDao {
    /** Every habit, in display order, on [day]. */
    fun observeDay(day: LocalDate): Flow<List<HabitDay>> =
        observeWithLogs(windowStart(day, HabitDay.RECENT_DAYS), day, habitId = null)
            .map { rows -> rows.toHabitDays(day, HabitDay.RECENT_DAYS) }

    /**
     * One habit on [day] with the [days] days ending at it, or null if it doesn't exist (any
     * more). Room has logs before the recent week only while history is kept ([HistoryDao]).
     */
    fun observeHabitDay(habitId: Int, day: LocalDate, days: Int = HabitDay.RECENT_DAYS): Flow<HabitDay?> {
        require(days >= 1) { "days must be at least 1" }
        return observeWithLogs(windowStart(day, days), day, habitId).map { rows -> rows.toHabitDays(day, days).firstOrNull() }
    }

    // One query, so habits, logs and timers always come from the same database state: stopping a
    // timer deletes it and logs its time in one transaction, and no frame may show only half of it.
    // One row per (habit, log in the window); log and timer columns are prefixed to keep them apart.
    @Query(
        """
        SELECT habits.*,
            day_logs.habitId AS log_habitId, day_logs.localDay AS log_localDay,
            day_logs.rating AS log_rating, day_logs.sessionCount AS log_sessionCount,
            timers.id AS timer_id, timers.habitId AS timer_habitId,
            timers.localDay AS timer_localDay, timers.startedAt AS timer_startedAt
        FROM habits
        LEFT JOIN day_logs ON day_logs.habitId = habits.id AND day_logs.localDay BETWEEN :start AND :end
        LEFT JOIN timers ON timers.habitId = habits.id
        WHERE :habitId IS NULL OR habits.id = :habitId
        ORDER BY habits.`order`, habits.id
        """,
    )
    protected abstract fun observeWithLogs(start: LocalDate, end: LocalDate, habitId: Int?): Flow<List<HabitDayRow>>

    private fun windowStart(day: LocalDate, days: Int) = day.minusDays(days - 1L)

    private fun List<HabitDayRow>.toHabitDays(day: LocalDate, days: Int): List<HabitDay> =
        groupBy { it.habit.id }.values.map { rows ->
            val byDay = rows.mapNotNull { it.log }.associateBy { it.localDay }
            val recent = (days - 1 downTo 0).map { back ->
                val d = day.minusDays(back.toLong())
                byDay[d]?.toRecentDay() ?: RecentDay(day = d, rating = null, sessionCount = 0)
            }
            HabitDay(rows.first().habit, recent, rows.first().timer)
        }
}

/** One row of [HabitDayDao]'s join. Room sets an embedded entity to null when all its columns are. */
data class HabitDayRow(
    @Embedded val habit: HabitEntity,
    @Embedded(prefix = "log_") val log: DayLogEntity?,
    @Embedded(prefix = "timer_") val timer: TimerEntity?,
)
