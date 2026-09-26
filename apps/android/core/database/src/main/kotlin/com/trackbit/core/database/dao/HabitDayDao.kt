package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.model.RecentDay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.LocalDate

/**
 * A habit on one day, plus the days before it: what tracker rows and widgets render. A
 * projection of `habits` and `day_logs`, never stored.
 */
data class HabitDay(
    val habit: HabitEntity,
    /** [RECENT_DAYS] days ending at the requested day, oldest first. Days without a log are empty. */
    val recent: List<RecentDay>,
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
        observeWithLogs(windowStart(day), day, habitId = null).map { rows -> rows.toHabitDays(day) }

    /** One habit on [day], or null if it doesn't exist (any more). */
    fun observeHabitDay(habitId: Int, day: LocalDate): Flow<HabitDay?> =
        observeWithLogs(windowStart(day), day, habitId).map { rows -> rows.toHabitDays(day).firstOrNull() }

    // One query, so habits and logs always come from the same database state.
    @Query(
        """
        SELECT * FROM habits
        LEFT JOIN day_logs ON day_logs.habitId = habits.id AND day_logs.localDay BETWEEN :start AND :end
        WHERE :habitId IS NULL OR habits.id = :habitId
        ORDER BY habits.`order`, habits.id
        """,
    )
    protected abstract fun observeWithLogs(start: LocalDate, end: LocalDate, habitId: Int?): Flow<Map<HabitEntity, List<DayLogEntity>>>

    private fun windowStart(day: LocalDate) = day.minusDays(HabitDay.RECENT_DAYS - 1L)

    private fun Map<HabitEntity, List<DayLogEntity>>.toHabitDays(day: LocalDate): List<HabitDay> = map { (habit, logs) ->
        val byDay = logs.associateBy { it.localDay }
        val recent = (HabitDay.RECENT_DAYS - 1 downTo 0).map { back ->
            val d = day.minusDays(back.toLong())
            byDay[d]?.toRecentDay() ?: RecentDay(day = d, rating = null, sessionCount = 0)
        }
        HabitDay(habit, recent)
    }
}
