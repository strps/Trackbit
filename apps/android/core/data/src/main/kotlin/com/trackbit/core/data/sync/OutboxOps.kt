package com.trackbit.core.data.sync

import com.trackbit.core.database.dao.HabitDayKey
import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.database.entity.OutboxOpType
import com.trackbit.core.model.CheckRequest
import com.trackbit.core.model.CreateExerciseLogRequest
import com.trackbit.core.model.CreatePerformanceRequest
import com.trackbit.core.model.CreateSessionRequest
import com.trackbit.core.model.DayLog
import com.trackbit.core.model.EnsureDayLogRequest
import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.model.SetValues
import com.trackbit.core.model.serialization.TrackbitJson
import com.trackbit.core.network.IdempotencyKey
import com.trackbit.core.network.service.TrackerService
import kotlinx.serialization.Serializable
import java.time.LocalDate

// The request body of each op type, both ways. Ops always send `day`: the local day the change
// was made to, which is also the Room row it changed optimistically. Session ops carry the uuids
// the app chose, so they need nothing from earlier ops' responses.

internal fun checkOp(habitId: Int, day: LocalDate, rating: Int) = OutboxEntity(
    type = OutboxOpType.Check,
    habitId = habitId,
    localDay = day,
    payload = TrackbitJson.encodeToString(CheckRequest(habitId, rating, day)),
)

internal fun incrementOp(habitId: Int, day: LocalDate, delta: Int) = OutboxEntity(
    type = OutboxOpType.Increment,
    habitId = habitId,
    localDay = day,
    payload = TrackbitJson.encodeToString(IncrementRequest(habitId, delta, day)),
)

internal fun ensureDayLogOp(habitId: Int, day: LocalDate) = OutboxEntity(
    type = OutboxOpType.EnsureDayLog,
    habitId = habitId,
    localDay = day,
    payload = TrackbitJson.encodeToString(EnsureDayLogRequest(habitId, day)),
)

/** A row named by its uuid: the payload of the delete ops. */
@Serializable
internal data class RowRef(val uuid: String)

/** The payload of [OutboxOpType.UpdatePerformance]. */
@Serializable
internal data class SetUpdate(val uuid: String, val values: SetValues)

internal fun createSessionOp(body: CreateSessionRequest) = OutboxEntity(
    type = OutboxOpType.CreateSession,
    habitId = body.habitId,
    localDay = body.day,
    payload = TrackbitJson.encodeToString(body),
)

internal fun createExerciseLogOp(day: HabitDayKey, body: CreateExerciseLogRequest) =
    sessionOp(OutboxOpType.CreateExerciseLog, day, TrackbitJson.encodeToString(body))

internal fun createPerformanceOp(day: HabitDayKey, body: CreatePerformanceRequest) =
    sessionOp(OutboxOpType.CreatePerformance, day, TrackbitJson.encodeToString(body))

internal fun updatePerformanceOp(day: HabitDayKey, update: SetUpdate) =
    sessionOp(OutboxOpType.UpdatePerformance, day, TrackbitJson.encodeToString(update))

/** [type] is one of the delete ops. */
internal fun deleteOp(type: OutboxOpType, day: HabitDayKey, uuid: String): OutboxEntity {
    require(type.deletes) { "$type doesn't delete" }
    return sessionOp(type, day, TrackbitJson.encodeToString(RowRef(uuid)))
}

private fun sessionOp(type: OutboxOpType, day: HabitDayKey, payload: String) =
    OutboxEntity(type = type, habitId = day.habitId, localDay = day.localDay, payload = payload)

/**
 * Sends [op] with the key it was queued with. Returns the day log a tracker write answers with,
 * or null for session ops, whose answer adds nothing to the optimistic rows. A payload that
 * doesn't decode throws.
 */
internal suspend fun TrackerService.send(op: OutboxEntity): DayLog? {
    val key = IdempotencyKey(op.idempotencyKey)
    val payload = op.payload
    return when (op.type) {
        OutboxOpType.Check -> check(TrackbitJson.decodeFromString<CheckRequest>(payload), key)
        OutboxOpType.Increment -> increment(TrackbitJson.decodeFromString<IncrementRequest>(payload), key)
        OutboxOpType.EnsureDayLog -> ensureDayLog(TrackbitJson.decodeFromString<EnsureDayLogRequest>(payload), key)
        // Session ops answer with their row, which adds nothing: each branch ends in an explicit
        // null. Not `null.also { call() }`: once the call really suspends, the value it resumes
        // with escapes the Unit-coerced lambda and comes out of `send` as if it were a DayLog.
        OutboxOpType.CreateSession -> {
            createSession(TrackbitJson.decodeFromString(payload), key)
            null
        }
        OutboxOpType.DeleteSession -> {
            deleteSession(payload.uuid(), key)
            null
        }
        OutboxOpType.CreateExerciseLog -> {
            createExerciseLog(TrackbitJson.decodeFromString(payload), key)
            null
        }
        OutboxOpType.DeleteExerciseLog -> {
            deleteExerciseLog(payload.uuid(), key)
            null
        }
        OutboxOpType.CreatePerformance -> {
            createPerformance(TrackbitJson.decodeFromString(payload), key)
            null
        }
        OutboxOpType.UpdatePerformance -> {
            val update = TrackbitJson.decodeFromString<SetUpdate>(payload)
            updatePerformance(update.uuid, update.values, key)
            null
        }
        OutboxOpType.DeletePerformance -> {
            deletePerformance(payload.uuid(), key)
            null
        }
    }
}

/** The uuid of the row a create op made, to undo it if the server refuses the op. */
internal fun OutboxEntity.createdUuid(): String? = when (type) {
    OutboxOpType.CreateSession -> TrackbitJson.decodeFromString<CreateSessionRequest>(payload).uuid
    OutboxOpType.CreateExerciseLog -> TrackbitJson.decodeFromString<CreateExerciseLogRequest>(payload).uuid
    OutboxOpType.CreatePerformance -> TrackbitJson.decodeFromString<CreatePerformanceRequest>(payload).uuid
    else -> null
}

/** Whether [this] is a session op, whose day's sessions a pull can repair. */
internal val OutboxOpType.isSessionOp: Boolean
    get() = this != OutboxOpType.Check && this != OutboxOpType.Increment && this != OutboxOpType.EnsureDayLog

private fun String.uuid() = TrackbitJson.decodeFromString<RowRef>(this).uuid
