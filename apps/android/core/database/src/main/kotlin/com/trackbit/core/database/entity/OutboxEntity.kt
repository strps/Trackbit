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

    // Session ops. They name rows by uuid, and their habitId/localDay is the session's day.

    /** `POST /api/tracker/exercise-sessions`, payload `CreateSessionRequest`. */
    CreateSession,

    /** `DELETE /api/tracker/exercise-sessions/uuid/:uuid`, payload `RowRef`. */
    DeleteSession,

    /** `POST /api/tracker/exercise-logs`, payload `CreateExerciseLogRequest`. */
    CreateExerciseLog,

    /** `DELETE /api/tracker/exercise-logs/uuid/:uuid`, payload `RowRef`. */
    DeleteExerciseLog,

    /** `POST /api/tracker/exercise-performances`, payload `CreatePerformanceRequest`. */
    CreatePerformance,

    /** `PATCH /api/tracker/exercise-performances/uuid/:uuid`, payload `SetUpdate`. */
    UpdatePerformance,

    /** `DELETE /api/tracker/exercise-performances/uuid/:uuid`, payload `RowRef`. */
    DeletePerformance,
    ;

    /** Deleting a row that is already gone (a 404) counts as done. */
    val deletes: Boolean get() = this == DeleteSession || this == DeleteExerciseLog || this == DeletePerformance
}

/**
 * A tracker write waiting to reach the server. Ops are sent in [id] order, and while any op for
 * ([habitId], [localDay]) is here, sync leaves that day log and that day's sessions alone.
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
