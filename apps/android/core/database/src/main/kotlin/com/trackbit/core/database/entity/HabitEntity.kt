package com.trackbit.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.TodayHabit
import com.trackbit.core.model.TrackableHabit
import java.time.LocalDate

/** A habit as of the last `GET /api/tracker/today`. */
@Entity(tableName = "habits")
data class HabitEntity(
    @PrimaryKey val id: Int,
    val name: String,
    val description: String?,
    override val type: HabitType,
    override val isAntiHabit: Boolean,
    val icon: HabitIcon,
    val colorTheme: ColorTheme,
    /** Resolved: the preset's stops, or the habit's own for [ColorTheme.Custom]. */
    val colorStops: List<ColorStop>,
    override val dailyGoal: Int,
    val weeklyGoal: Int,
    val order: Int,
    val frozen: Boolean,
    /** The earliest day with a log, server-side or pending. Null means never logged. */
    val firstLogDay: LocalDate?,
    /** The server's streak ending the day before [summaryDay]. */
    val streakBeforeDay: Int,
    /** The day the summary was fetched for. [streakBeforeDay] is only valid for this day. */
    val summaryDay: LocalDate,
) : TrackableHabit

fun TodayHabit.toEntity(summaryDay: LocalDate) = HabitEntity(
    id = id,
    name = name,
    description = description,
    type = type,
    isAntiHabit = isAntiHabit,
    icon = icon,
    colorTheme = colorTheme,
    colorStops = colorStops,
    dailyGoal = dailyGoal,
    weeklyGoal = weeklyGoal,
    order = order,
    frozen = frozen,
    firstLogDay = firstLogDay,
    streakBeforeDay = streakBeforeDay,
    summaryDay = summaryDay,
)
