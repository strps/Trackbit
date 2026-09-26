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
