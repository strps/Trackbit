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
    /**
     * Room holds every log of the habit from this day on (as of the last syncs, plus local
     * writes): the week of the last `/today`, or further back when history was pulled. An empty
     * day before it may just be unknown. Null while no `/today` has summarized the habit: none
     * of its logs is known then.
     */
    val logsKnownFrom: LocalDate?,
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
    /** Every habit, in display order, on [day], with the [days] days ending at it. */
    fun observeDay(day: LocalDate, days: Int = HabitDay.RECENT_DAYS): Flow<List<HabitDay>> {
        require(days >= 1) { "days must be at least 1" }
        return observeWithLogs(windowStart(day, days), day, habitUuid = null).map { rows -> rows.toHabitDays(day, days) }
    }

    /**
     * One habit on [day] with the [days] days ending at it, or null if it doesn't exist (any
     * more). Room has logs before the recent week only while history is kept ([HistoryDao]).
     */
    fun observeHabitDay(habitUuid: String, day: LocalDate, days: Int = HabitDay.RECENT_DAYS): Flow<HabitDay?> {
        require(days >= 1) { "days must be at least 1" }
        return observeWithLogs(windowStart(day, days), day, habitUuid).map { rows -> rows.toHabitDays(day, days).firstOrNull() }
    }

    // One query, so habits, logs and timers always come from the same database state: stopping a
    // timer deletes it and logs its time in one transaction, and no frame may show only half of it.
    // One row per (habit, log in the window); log and timer columns are prefixed to keep them apart.
    @Query(
        """
        SELECT habits.*,
            day_logs.habitUuid AS log_habitUuid, day_logs.localDay AS log_localDay,
            day_logs.rating AS log_rating, day_logs.sessionCount AS log_sessionCount,
            timers.id AS timer_id, timers.habitUuid AS timer_habitUuid,
            timers.localDay AS timer_localDay, timers.startedAt AS timer_startedAt,
            (SELECT MIN(syncedStart) FROM history) AS historyFrom
        FROM habits
        LEFT JOIN day_logs ON day_logs.habitUuid = habits.uuid AND day_logs.localDay BETWEEN :start AND :end
        LEFT JOIN timers ON timers.habitUuid = habits.uuid
        WHERE :habitUuid IS NULL OR habits.uuid = :habitUuid
        ORDER BY habits.`order`, habits.uuid
        """,
    )
    protected abstract fun observeWithLogs(start: LocalDate, end: LocalDate, habitUuid: String?): Flow<List<HabitDayRow>>

    private fun windowStart(day: LocalDate, days: Int) = day.minusDays(days - 1L)

    private fun List<HabitDayRow>.toHabitDays(day: LocalDate, days: Int): List<HabitDay> =
        groupBy { it.habit.uuid }.values.map { rows ->
            val byDay = rows.mapNotNull { it.log }.associateBy { it.localDay }
            val recent = (days - 1 downTo 0).map { back ->
                val d = day.minusDays(back.toLong())
                byDay[d]?.toRecentDay() ?: RecentDay(day = d, rating = null, sessionCount = 0)
            }
            val first = rows.first()
            // Every pull reaches the device's day, and `sync()` pulls history when stale, so the
            // pulled range and the recent week meet.
            val recentFrom = first.habit.summaryDay?.minusDays(HabitDay.RECENT_DAYS - 1L)
            HabitDay(first.habit, recent, first.timer, recentFrom?.let { listOfNotNull(it, first.historyFrom).min() })
        }
}

/** One row of [HabitDayDao]'s join. Room sets an embedded entity to null when all its columns are. */
data class HabitDayRow(
    @Embedded val habit: HabitEntity,
    @Embedded(prefix = "log_") val log: DayLogEntity?,
    @Embedded(prefix = "timer_") val timer: TimerEntity?,
    /** The earliest day a history pull covered, if any. */
    val historyFrom: LocalDate?,
)
