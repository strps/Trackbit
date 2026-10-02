package com.trackbit.core.model

import com.trackbit.core.model.serialization.LocalDateSerializer
import kotlinx.serialization.Serializable
import java.time.LocalDate

// Tracker write bodies. `day` is the local day the user is looking at; leave it null only for
// widget or background writes meant for the server's "today". A null `day` is not encoded.

/** `POST /api/tracker/check`: set the day's rating to an absolute value. */
@Serializable
data class CheckRequest(
    val habitId: Int,
    val rating: Int,
    @Serializable(with = LocalDateSerializer::class) val day: LocalDate? = null,
)

/** `POST /api/tracker/check/increment`: add [delta] (never 0) to the day's rating. */
@Serializable
data class IncrementRequest(
    val habitId: Int,
    val delta: Int,
    @Serializable(with = LocalDateSerializer::class) val day: LocalDate? = null,
) {
    init {
        require(delta != 0) { "delta must not be 0" }
    }
}

/** `POST /api/tracker/day-logs/ensure`: get the day's log, creating an empty one. */
@Serializable
data class EnsureDayLogRequest(
    val habitId: Int,
    @Serializable(with = LocalDateSerializer::class) val day: LocalDate? = null,
)

// Session writes. Each create names the new row by a [uuid] the app chose and its parent by the
// parent's uuid, so a whole session can be queued offline. A retried create returns the first row.

/** `POST /api/tracker/exercise-sessions`: start a session, creating the day's log if needed. */
@Serializable
data class CreateSessionRequest(
    val uuid: String,
    val habitId: Int,
    @Serializable(with = LocalDateSerializer::class) val day: LocalDate,
)

/** `POST /api/tracker/exercise-logs`: add an exercise to a session. */
@Serializable
data class CreateExerciseLogRequest(
    val uuid: String,
    val exerciseSessionUuid: String,
    val exerciseId: Int,
    /** The list item it was picked from, for adherence; null for an ad-hoc pick. */
    val listItemId: Int?,
)

/**
 * What a set records, stored as the web stores it. Every field is sent, null included, so an edit
 * (`PATCH /api/tracker/exercise-performances/uuid/:uuid`, this is its body) can clear one.
 */
@Serializable
data class SetValues(
    val reps: Int?,
    val weight: Double?,
    /** Milliseconds. */
    val duration: Int?,
    val distance: Double?,
    /** Rate of perceived exertion, 1–10. */
    val rpe: Int?,
) {
    companion object {
        val EMPTY = SetValues(reps = null, weight = null, duration = null, distance = null, rpe = null)
    }
}

/** `POST /api/tracker/exercise-performances`: add a set to a log. */
@Serializable
data class CreatePerformanceRequest(
    val uuid: String,
    val exerciseLogUuid: String,
    /** Its place in the log, from 1. */
    val number: Int,
    val reps: Int?,
    val weight: Double?,
    val duration: Int?,
    val distance: Double?,
    val rpe: Int?,
) {
    constructor(uuid: String, exerciseLogUuid: String, number: Int, values: SetValues) : this(
        uuid, exerciseLogUuid, number, values.reps, values.weight, values.duration, values.distance, values.rpe,
    )
}
