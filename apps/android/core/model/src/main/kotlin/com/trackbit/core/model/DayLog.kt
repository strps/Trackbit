package com.trackbit.core.model

import com.trackbit.core.model.serialization.InstantSerializer
import com.trackbit.core.model.serialization.LocalDateSerializer
import kotlinx.serialization.Serializable
import java.time.Instant
import java.time.LocalDate

/**
 * A `day_logs` row, returned by every tracker write. Identify it by ([habitUuid], [localDay]);
 * [id] is the server's key, which the app doesn't use.
 */
@Serializable
data class DayLog(
    val id: Int,
    val habitUuid: String,
    /** A count, 1/0 for check habits, or milliseconds for timed habits. */
    val rating: Int?,
    val notes: String?,
    @Serializable(with = LocalDateSerializer::class) val localDay: LocalDate,
    @Serializable(with = InstantSerializer::class) val timeStamp: Instant,
    @Serializable(with = InstantSerializer::class) val createdAt: Instant,
)
