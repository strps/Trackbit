package com.trackbit.core.data.sync

import androidx.room.withTransaction
import com.trackbit.core.data.SyncResult
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.database.entity.HistoryEntity
import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.SessionTokenSource
import com.trackbit.core.network.safeCall
import com.trackbit.core.network.service.TrackerService
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Moves tracker data between Room and the server: [flush] sends the outbox, [sync] also pulls
 * `/today` (and history when it's due), [syncHistory] pulls only history. Workers and
 * pull-to-refresh go through here.
 *
 * One at a time: a pull that overlapped a flush could store a snapshot taken before an op that
 * was confirmed meanwhile, and two flushes would send the same op twice.
 *
 * Every Room write is fenced on the session it started with, checked inside the transaction. A
 * sign-out clears Room from a [com.trackbit.core.auth.SignOutHook] after forgetting the token,
 * so a response that arrives after that is dropped instead of writing the old user's data back.
 */
@Singleton
internal class TrackerSync @Inject constructor(
    private val db: TrackbitDatabase,
    private val trackerService: TrackerService,
    private val tokens: SessionTokenSource,
    private val clock: Clock,
) {
    private val mutex = Mutex()
    private val outbox = db.outboxDao()

    /** Sends every queued op, oldest first. If the server rejected any, pulls to undo them. */
    suspend fun flush(): SyncResult = mutex.withLock {
        val token = tokens.currentToken() ?: return SyncResult.SignedOut
        val flushed = flushLocked(token)
        if (flushed.dropped && flushed.result != SyncResult.SignedOut) worse(flushed.result, pullLocked(token)) else flushed.result
    }

    /** Sends the outbox, then replaces Room's copy of today with the server's. */
    suspend fun sync(): SyncResult = mutex.withLock {
        val token = tokens.currentToken() ?: return SyncResult.SignedOut
        val flushed = flushLocked(token)
        if (flushed.result == SyncResult.SignedOut) return SyncResult.SignedOut
        // Ops still waiting to be retried are safe: the pull leaves their day logs alone.
        val pulled = worse(flushed.result, pullLocked(token))
        if (pulled == SyncResult.SignedOut) pulled else worse(pulled, pullHistoryLocked(token))
    }

    /** Pulls the requested history if it's due (see [HistoryEntity]). */
    suspend fun syncHistory(): SyncResult = mutex.withLock {
        val token = tokens.currentToken() ?: return SyncResult.SignedOut
        pullHistoryLocked(token)
    }

    private class Flushed(val result: SyncResult, val dropped: Boolean)

    private suspend fun flushLocked(token: String): Flushed {
        var dropped = false
        while (true) {
            val op = outbox.oldest() ?: return Flushed(SyncResult.Done, dropped)
            when (val sent = safeCall { trackerService.send(op) }) {
                is ApiResult.Success ->
                    if (!fenced(token) { db.syncDao().applyConfirmed(op.id, sent.value) }) return Flushed(SyncResult.SignedOut, dropped)
                is ApiResult.Failure -> when (val action = sent.error.action(op)) {
                    FailureAction.Drop -> {
                        if (!fenced(token) { outbox.delete(op.id) }) return Flushed(SyncResult.SignedOut, dropped)
                        dropped = true
                    }
                    FailureAction.Retry, FailureAction.RetryCounted -> {
                        if (action == FailureAction.RetryCounted && !fenced(token) { outbox.recordFailure(op.id) }) {
                            return Flushed(SyncResult.SignedOut, dropped)
                        }
                        // FIFO: later ops may build on this one, so nothing overtakes it.
                        return Flushed(SyncResult.Retry, dropped)
                    }
                    // The interceptor has signed out, which clears the outbox.
                    FailureAction.Stop -> return Flushed(SyncResult.SignedOut, dropped)
                }
            }
        }
    }

    private suspend fun pullLocked(token: String): SyncResult {
        // The device's day, so the summary is for the day the app shows as today.
        return when (val today = safeCall { trackerService.today(LocalDate.now()) }) {
            is ApiResult.Success -> if (fenced(token) { db.syncDao().applyToday(today.value) }) SyncResult.Done else SyncResult.SignedOut
            is ApiResult.Failure -> today.error.toPullResult()
        }
    }

    /**
     * Pulls from the earliest start of the requests that are due up to today, in chunks `/days`
     * accepts. Newest first, so after each chunk Room is fresh from its start on (see
     * [com.trackbit.core.database.dao.SyncDao.applyDays]); a failure leaves the rest due.
     */
    private suspend fun pullHistoryLocked(token: String): SyncResult {
        val now = clock.instant()
        val due = db.historyDao().all().filter { it.isDue(now) }
        if (due.isEmpty()) return SyncResult.Done
        val start = due.minOf { it.start }
        var end = LocalDate.now()
        while (!end.isBefore(start)) {
            val chunkStart = maxOf(start, end.minusDays(MAX_DAYS_PER_PULL - 1L))
            when (val days = safeCall { trackerService.days(chunkStart, end) }) {
                is ApiResult.Success -> if (!fenced(token) { db.syncDao().applyDays(days.value, now) }) return SyncResult.SignedOut
                is ApiResult.Failure -> return days.error.toPullResult()
            }
            end = chunkStart.minusDays(1)
        }
        return SyncResult.Done
    }

    private fun ApiError.toPullResult(): SyncResult = when (this) {
        is ApiError.Network, is ApiError.Server, ApiError.RequestInProgress -> SyncResult.Retry
        is ApiError.Unauthorized -> SyncResult.SignedOut
        else -> SyncResult.Failed
    }

    private enum class FailureAction { Retry, RetryCounted, Drop, Stop }

    private fun ApiError.action(op: OutboxEntity): FailureAction = when (this) {
        // Offline for days is normal: never give up on those.
        is ApiError.Network -> FailureAction.Retry
        // A request the server keeps failing would block the queue forever.
        is ApiError.Server, ApiError.RequestInProgress ->
            if (op.attempts + 1 >= MAX_SERVER_ATTEMPTS) FailureAction.Drop else FailureAction.RetryCounted
        is ApiError.Unauthorized -> FailureAction.Stop
        // Frozen, deleted, invalid: retrying can't help, and the pull after it undoes the change.
        else -> FailureAction.Drop
    }

    /** Runs [block] in a transaction if [token] is still the session's. False if it isn't. */
    private suspend fun fenced(token: String, block: suspend () -> Unit): Boolean = db.withTransaction {
        if (tokens.currentToken() != token) return@withTransaction false
        block()
        true
    }

    private fun worse(a: SyncResult, b: SyncResult) = maxOf(a, b)

    companion object {
        /** Hours of retrying under WorkManager's exponential backoff (30 s, doubling). */
        const val MAX_SERVER_ATTEMPTS = 10

        /**
         * How long pulled history counts as fresh. Past days rarely change, and the last week
         * comes with every `/today`.
         */
        val HISTORY_MAX_AGE: Duration = Duration.ofHours(6)

        /** The most days one `GET /api/tracker/days` returns (the backend's limit). */
        const val MAX_DAYS_PER_PULL = 371
    }
}

/** Whether this request must be pulled: never pulled, pulled from a later start, or stale. */
internal fun HistoryEntity.isDue(now: Instant): Boolean {
    val pulledFrom = syncedStart ?: return true
    val pulledAt = syncedAt ?: return true
    return pulledFrom.isAfter(start) || Duration.between(pulledAt, now) >= TrackerSync.HISTORY_MAX_AGE
}
