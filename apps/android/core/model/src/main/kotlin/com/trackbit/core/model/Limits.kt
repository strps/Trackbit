package com.trackbit.core.model

import kotlinx.serialization.Serializable

/** `GET /api/me/limits`. */
@Serializable
data class LimitsResponse(
    /** Null when nothing is capped (admins). */
    val effective: EffectiveLimits?,
    val counts: LimitCounts,
)

/** A null maximum means no cap. */
@Serializable
data class EffectiveLimits(
    val maxHabits: Int?,
    val maxCustomExercises: Int?,
    val maxExerciseLists: Int?,
    val allowedHabitTypes: List<HabitType>,
)

@Serializable
data class LimitCounts(
    val habits: Int,
    val customExercises: Int,
    val exerciseLists: Int,
)
