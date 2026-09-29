package com.trackbit.core.model

import com.trackbit.core.model.serialization.LocalDateSerializer
import kotlinx.serialization.Serializable
import java.time.LocalDate

/**
 * `GET /api/tracker/days?start=&end=`: every habit's logged days in the range, as in
 * [TodayHabit.recent]. Sparse: a day without a log isn't listed.
 */
@Serializable
data class DaysResponse(
    @Serializable(with = LocalDateSerializer::class) val start: LocalDate,
    @Serializable(with = LocalDateSerializer::class) val end: LocalDate,
    val days: List<HabitDayValue>,
)

@Serializable
data class HabitDayValue(
    val habitId: Int,
    @Serializable(with = LocalDateSerializer::class) val day: LocalDate,
    val rating: Int?,
    val sessionCount: Int,
)
