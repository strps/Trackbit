package com.trackbit.core.data

import androidx.room.withTransaction
import com.trackbit.core.data.sync.SyncScheduler
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.database.entity.OutboxEntity

/**
 * Pairs an optimistic Room change with its outbox op in one transaction, the only way tracker
 * and session writes reach Room, then starts a flush.
 */
internal class OutboxWriter(private val db: TrackbitDatabase, private val scheduler: SyncScheduler) {
    private val habitDao = db.habitDao()
    private val outboxDao = db.outboxDao()

    /** Applies [change] and queues the op it returns, in one transaction, then starts a flush. */
    suspend fun write(habitUuid: String, change: suspend () -> OutboxEntity?): WriteResult =
        flushIfQueued(db.withTransaction { queue(habitUuid, change) })

    /**
     * Inside a transaction: applies [change] and queues its op, unless [habitUuid]'s habit is frozen
     * or gone. A null op from [change] means it found nothing to do ([WriteResult.NoChange]).
     */
    suspend fun queue(habitUuid: String, change: suspend () -> OutboxEntity?): WriteResult {
        val habit = habitDao.get(habitUuid) ?: return WriteResult.HabitNotFound
        if (habit.frozen) return WriteResult.HabitFrozen
        val op = change() ?: return WriteResult.NoChange
        // The server's first log day is its earliest row; an anti-habit streak starts there.
        habitDao.extendFirstLogDay(habitUuid, op.localDay)
        outboxDao.enqueue(op)
        return WriteResult.Queued
    }

    fun flushIfQueued(result: WriteResult): WriteResult {
        if (result == WriteResult.Queued) scheduler.flushOutbox()
        return result
    }
}
