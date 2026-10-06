package com.trackbit.core.model

import com.trackbit.core.model.serialization.LocalDateSerializer
import kotlinx.serialization.Serializable
import java.time.LocalDate

/** `GET /api/tracker/today?day=`: per-habit state for one day. */
@Serializable
data class TodayResponse(
    @Serializable(with = LocalDateSerializer::class) val day: LocalDate,
    val habits: List<TodayHabit>,
)

@Serializable
data class TodayHabit(
    val uuid: String,
    val name: String,
    val description: String?,
    override val type: HabitType,
    override val isAntiHabit: Boolean,
    val icon: HabitIcon,
    val colorTheme: ColorTheme,
    /** Already resolved: the preset's stops, or the habit's own for [ColorTheme.Custom]. */
    val colorStops: List<ColorStop>,
    override val dailyGoal: Int,
    val weeklyGoal: Int,
    val order: Int,
    val frozen: Boolean,
    @Serializable(with = LocalDateSerializer::class) val firstLogDay: LocalDate?,
    /** The streak ending the day before [TodayResponse.day]; see [Streak.current]. */
    val streakBeforeDay: Int,
    /** The 7 days ending at [TodayResponse.day], oldest first. */
    val recent: List<RecentDay>,
) : TrackableHabit

@Serializable
data class RecentDay(
    @Serializable(with = LocalDateSerializer::class) val day: LocalDate,
    val rating: Int?,
    val sessionCount: Int,
)
