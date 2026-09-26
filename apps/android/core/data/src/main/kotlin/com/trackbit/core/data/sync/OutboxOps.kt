package com.trackbit.core.data.sync

import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.database.entity.OutboxOpType
import com.trackbit.core.model.CheckRequest
import com.trackbit.core.model.DayLog
import com.trackbit.core.model.EnsureDayLogRequest
import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.model.serialization.TrackbitJson
import com.trackbit.core.network.IdempotencyKey
import com.trackbit.core.network.service.TrackerService
import java.time.LocalDate

// The request body of each op type, both ways. Ops always send `day`: the local day the change
// was made to, which is also the Room row it changed optimistically.

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

/** Sends [op] with the key it was queued with. A payload that doesn't decode throws. */
internal suspend fun TrackerService.send(op: OutboxEntity): DayLog {
    val key = IdempotencyKey(op.idempotencyKey)
    return when (op.type) {
        OutboxOpType.Check -> check(TrackbitJson.decodeFromString<CheckRequest>(op.payload), key)
        OutboxOpType.Increment -> increment(TrackbitJson.decodeFromString<IncrementRequest>(op.payload), key)
        OutboxOpType.EnsureDayLog -> ensureDayLog(TrackbitJson.decodeFromString<EnsureDayLogRequest>(op.payload), key)
    }
}
