package com.trackbit.core.data

import com.trackbit.core.database.dao.HabitDay
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.RecentDay
import com.trackbit.core.model.Streak
import com.trackbit.core.model.StreakDay
import com.trackbit.core.model.TrackableHabit
import java.time.LocalDate

/** A habit on one day, as tracker screens and widgets show it. Everything comes from Room. */
data class TrackedHabit(
    val id: Int,
    val name: String,
    val description: String?,
    override val type: HabitType,
    override val isAntiHabit: Boolean,
    val icon: HabitIcon,
    val colorTheme: ColorTheme,
    val colorStops: List<ColorStop>,
    override val dailyGoal: Int,
    val weeklyGoal: Int,
    /** Over the user's role limits: shown, but writes are refused. */
    val frozen: Boolean,
    val day: LocalDate,
    /** The days ending at [day], oldest first; the last one is [day] itself (optimistic). */
    val recent: List<RecentDay>,
    val progress: HabitProgress,
    /**
     * The streak including [day]. Null when it can't be known until a sync: a day before the last
     * sync, or a sync so old that the days since fall outside [recent].
     */
    val streak: Int?,
) : TrackableHabit {
    val today: RecentDay get() = recent.last()
}

internal fun HabitDay.toTrackedHabit(): TrackedHabit {
    val day = current.day
    val logs = recent.associate { it.day to StreakDay(it.rating, it.sessionCount) }
    // Every log from the summary day on must be known to bridge the streak across the gap.
    val before = if (habit.summaryDay.isBefore(recent.first().day)) {
        null
    } else {
        Streak.beforeDay(habit, logs, day, habit.firstLogDay, habit.summaryDay, habit.streakBeforeDay)
    }
    val streak = if (Streak.dayCounts(habit, logs[day], day, habit.firstLogDay)) before?.plus(1) else 0
    return TrackedHabit(
        id = habit.id,
        name = habit.name,
        description = habit.description,
        type = habit.type,
        isAntiHabit = habit.isAntiHabit,
        icon = habit.icon,
        colorTheme = habit.colorTheme,
        colorStops = habit.colorStops,
        dailyGoal = habit.dailyGoal,
        weeklyGoal = habit.weeklyGoal,
        frozen = habit.frozen,
        day = day,
        recent = recent,
        progress = HabitProgress.of(habit, current.rating, current.sessionCount),
        streak = streak,
    )
}
