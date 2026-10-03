package com.trackbit.core.model

import com.trackbit.core.model.serialization.LocalDateSerializer
import kotlinx.serialization.Serializable
import java.time.LocalDate

/** `GET /api/tracker/sets?habitId=`: every set of one workout habit, oldest day first. */
@Serializable
data class HabitSetsResponse(
    val habitId: Int,
    val sets: List<HabitSet>,
)

/** One set, flattened out of its session and log: what the analytics charts aggregate. */
@Serializable
data class HabitSet(
    @Serializable(with = LocalDateSerializer::class) val day: LocalDate,
    val exerciseId: Int,
    /** Kilograms. */
    val weight: Double?,
    val reps: Int?,
    val rpe: Int?,
    /** Milliseconds. */
    val duration: Int?,
    val distance: Double?,
)
