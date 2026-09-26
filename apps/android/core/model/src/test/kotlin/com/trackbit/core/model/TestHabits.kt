package com.trackbit.core.model

import java.time.LocalDate

data class TestHabit(
    override val type: HabitType,
    override val isAntiHabit: Boolean = false,
    override val dailyGoal: Int = 1,
) : TrackableHabit

fun day(iso: String): LocalDate = LocalDate.parse(iso)
