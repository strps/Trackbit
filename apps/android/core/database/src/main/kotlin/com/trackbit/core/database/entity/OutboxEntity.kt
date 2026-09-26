package com.trackbit.core.database.entity

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

enum class OutboxOpType {
    /** `POST /api/tracker/check`, payload `CheckRequest`. */
    Check,

    /** `POST /api/tracker/check/increment`, payload `IncrementRequest`. */
    Increment,

    /** `POST /api/tracker/day-logs/ensure`, payload `EnsureDayLogRequest`. */
    EnsureDayLog,
}

/**
 * A tracker write waiting to reach the server. Ops are sent in [id] order, and while any op for
 * ([habitId], [localDay]) is here, sync leaves that day log alone.
 */
@Entity(
    tableName = "outbox",
    indices = [Index("idempotencyKey", unique = true), Index("habitId", "localDay")],
)
data class OutboxEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val type: OutboxOpType,
    /** The day log this op changed optimistically. The payload may still omit `day`. */
    val habitId: Int,
    val localDay: LocalDate,
    /** The request body as JSON, per [type]. */
    val payload: String,
    /** Fixed when the op is created and sent unchanged on every retry. */
    val idempotencyKey: String = UUID.randomUUID().toString(),
    val createdAt: Instant = Instant.now(),
    /** Failed sends so far, for backoff and giving up. */
    val attempts: Int = 0,
)
