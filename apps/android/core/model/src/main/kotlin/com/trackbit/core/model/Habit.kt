package com.trackbit.core.model

import com.trackbit.core.model.serialization.InstantSerializer
import kotlinx.serialization.Serializable
import java.time.Instant

/** A row of `GET /api/habits`, also returned by habit create and update. */
@Serializable
data class Habit(
    /** The app names a habit by it; the server's int `id` is the web's. */
    val uuid: String,
    val userId: String,
    val name: String,
    val description: String?,
    override val type: HabitType,
    override val isAntiHabit: Boolean,
    val colorTheme: ColorTheme,
    /** The habit's own stops. Only meaningful for [ColorTheme.Custom]; presets render their own. */
    val colorStops: List<ColorStop>,
    val icon: HabitIcon,
    val weeklyGoal: Int,
    override val dailyGoal: Int,
    val order: Int,
    @Serializable(with = InstantSerializer::class) val createdAt: Instant?,
    /** Only the list endpoint computes it; create and update responses omit it. */
    val frozen: Boolean = false,
) : TrackableHabit
