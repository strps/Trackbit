package com.trackbit.core.data.sync

import androidx.room.withTransaction
import com.trackbit.core.data.SyncResult
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.database.dao.HabitDayKey
import com.trackbit.core.database.dao.SyncDao
import com.trackbit.core.database.entity.ConfigPart
import com.trackbit.core.database.entity.HistoryEntity
import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.database.entity.OutboxOpType
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.SessionTokenSource
import com.trackbit.core.network.safeCall
import com.trackbit.core.network.service.ExerciseListService
import com.trackbit.core.network.service.ExerciseService
import com.trackbit.core.network.service.HabitsService
import com.trackbit.core.network.service.MeService
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
 * Moves data between Room and the server: [flush] sends the outbox, [sync] also pulls `/today`
 * (and history and the config when they're due), [syncHistory] pulls only history,
 * [syncSessions] pulls one day's sessions, the exercise catalog and the picker's sources,
 * [syncQueue] one source's queue, [syncSources] the sources and every cached queue after a list
 * write, [syncSets] a habit's sets for analytics, [syncConfig] parts of the config. [write] and
 * [delete] send a config write and store its answer. Workers, pull-to-refresh and the config
 * repositories go through here.
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
    private val exerciseService: ExerciseService,
    private val habitsService: HabitsService,
    private val listService: ExerciseListService,
    private val meService: MeService,
    private val tokens: SessionTokenSource,
    private val clock: Clock,
) {
    private val mutex = Mutex()
    private val outbox = db.outboxDao()

    /** Sends every queued op, oldest first. If the server rejected any, pulls to undo them. */
    suspend fun flush(): SyncResult = mutex.withLock {
        val token = tokens.currentToken() ?: return SyncResult.SignedOut
        val flushed = flushLocked(token)
        if (flushed.result == SyncResult.SignedOut) return SyncResult.SignedOut
        if (flushed.dropped) worse(flushed.result, repairLocked(token, flushed)) else flushed.result
    }

    /**
     * Sends the outbox, then replaces Room's copy of today with the server's, and pulls history and
     * the parts of the config that are due (never pulled, or older than [CONFIG_MAX_AGE]).
     */
    suspend fun sync(): SyncResult = mutex.withLock {
        val token = tokens.currentToken() ?: return SyncResult.SignedOut
        val flushed = flushLocked(token)
        if (flushed.result == SyncResult.SignedOut) return SyncResult.SignedOut
        // Ops still waiting to be retried are safe: the pull leaves their day logs alone.
        var result = worse(flushed.result, repairLocked(token, flushed))
        if (result == SyncResult.SignedOut) return SyncResult.SignedOut
        result = worse(result, pullHistoryLocked(token))
        if (result == SyncResult.SignedOut) return SyncResult.SignedOut
        val pulls = db.syncDao().configPulls()
        val now = clock.instant()
        val due = ConfigPart.entries.filter { part ->
            pulls[part]?.let { Duration.between(it, now) >= CONFIG_MAX_AGE } ?: true
        }
        worse(result, pullConfigLocked(token, due))
    }

    /** Replaces Room's copy of each of [parts] with the server's, e.g. when a config screen opens. */
    suspend fun syncConfig(vararg parts: ConfigPart): SyncResult = mutex.withLock {
        val token = tokens.currentToken() ?: return SyncResult.SignedOut
        pullConfigLocked(token, parts.asList())
    }

    /**
     * Sends a config write and, once it succeeds, puts its answer into Room with [store], fenced on
     * the session the write started with. Storing waits for a running pull, so a pull that read
     * the server before the write can't land after it with the old rows.
     */
    suspend fun <T> write(call: suspend () -> T, store: suspend SyncDao.(T) -> Unit): ApiResult<T> {
        val token = tokens.currentToken()
        return stored(token, safeCall(call), store)
    }

    /** [write] for a delete: one that finds the row gone did what it wanted, so [store] drops Room's copy then too. */
    suspend fun delete(call: suspend () -> Unit, store: suspend SyncDao.() -> Unit): ApiResult<Unit> {
        val token = tokens.currentToken()
        val sent = safeCall(call)
        val result = if (sent is ApiResult.Failure && sent.error is ApiError.NotFound) ApiResult.Success(Unit) else sent
        return stored(token, result) { store() }
    }

    private suspend fun <T> stored(token: String?, result: ApiResult<T>, store: suspend SyncDao.(T) -> Unit): ApiResult<T> {
        if (result is ApiResult.Success && token != null) {
            mutex.withLock { fenced(token) { db.syncDao().store(result.value) } }
        }
        return result
    }

    /**
     * Sends the outbox, then replaces Room's sessions of [habitUuid] on [day] with the server's
     * (unless ops for that day are still pending) and refreshes the exercise catalog and the
     * picker's sources.
     */
    suspend fun syncSessions(habitUuid: String, day: LocalDate): SyncResult = mutex.withLock {
        val token = tokens.currentToken() ?: return SyncResult.SignedOut
        val flushed = flushLocked(token)
        if (flushed.result == SyncResult.SignedOut) return SyncResult.SignedOut
        var result = if (flushed.dropped) worse(flushed.result, repairLocked(token, flushed)) else flushed.result
        if (result == SyncResult.SignedOut) return SyncResult.SignedOut
        result = worse(result, pullSessionsLocked(token, HabitDayKey(habitUuid, day)))
        if (result == SyncResult.SignedOut) return SyncResult.SignedOut
        result = worse(result, pullExercisesLocked(token))
        if (result == SyncResult.SignedOut) return SyncResult.SignedOut
        worse(result, pullSourcesLocked(token))
    }

    /** Replaces Room's copy of [key]'s queue; a 404 records that it no longer resolves. */
    suspend fun syncQueue(key: String): SyncResult = mutex.withLock {
        val token = tokens.currentToken() ?: return SyncResult.SignedOut
        pullQueueLocked(token, key)
    }

    /**
     * A list was written on the server: replaces Room's sources (names, counts, capabilities) and
     * every queue Room holds, so the picker and new sets' prescriptions follow the edit.
     */
    suspend fun syncSources(): SyncResult = mutex.withLock {
        val token = tokens.currentToken() ?: return SyncResult.SignedOut
        var result = pullSourcesLocked(token)
        if (result != SyncResult.Done) return result
        for (key in db.syncDao().cachedQueueKeys()) {
            result = worse(result, pullQueueLocked(token, key))
            if (result == SyncResult.SignedOut) return result
        }
        result
    }

    /**
     * Replaces Room's copy of [habitUuid]'s sets (for analytics) and refreshes the exercise catalog,
     * which names their exercises and muscle groups. Sets still in the outbox aren't in the pull.
     */
    suspend fun syncSets(habitUuid: String): SyncResult = mutex.withLock {
        val token = tokens.currentToken() ?: return SyncResult.SignedOut
        val result = when (val sets = safeCall { trackerService.sets(habitUuid) }) {
            is ApiResult.Success ->
                if (fenced(token) { db.syncDao().applySets(sets.value, clock.instant()) }) SyncResult.Done else return SyncResult.SignedOut
            is ApiResult.Failure -> sets.error.toPullResult()
        }
        if (result == SyncResult.SignedOut) return SyncResult.SignedOut
        worse(result, pullExercisesLocked(token))
    }

    /** Pulls the requested history if it's due (see [HistoryEntity]). */
    suspend fun syncHistory(): SyncResult = mutex.withLock {
        val token = tokens.currentToken() ?: return SyncResult.SignedOut
        pullHistoryLocked(token)
    }

    /** [sessionDays]: the days of dropped session ops, whose sessions a pull should repair. */
    private class Flushed(val result: SyncResult, val dropped: Boolean, val sessionDays: Set<HabitDayKey>)

    private suspend fun flushLocked(token: String): Flushed {
        var dropped = false
        val sessionDays = mutableSetOf<HabitDayKey>()
        fun done(result: SyncResult) = Flushed(result, dropped, sessionDays)
        while (true) {
            val op = outbox.oldest() ?: return done(SyncResult.Done)
            val sent = safeCall { trackerService.send(op) }
            // A delete retried after a lost response finds the row gone: that is what it wanted.
            val confirmed = sent is ApiResult.Success ||
                (op.type.deletes && (sent as ApiResult.Failure).error is ApiError.NotFound)
            if (confirmed) {
                val log = (sent as? ApiResult.Success)?.value
                if (!fenced(token) { if (log != null) db.syncDao().applyConfirmed(op.id, log) else outbox.delete(op.id) }) {
                    return done(SyncResult.SignedOut)
                }
                continue
            }
            when (val action = (sent as ApiResult.Failure).error.action(op)) {
                FailureAction.Drop -> {
                    if (!fenced(token) { drop(op) }) return done(SyncResult.SignedOut)
                    dropped = true
                    if (op.type.isSessionOp) sessionDays += HabitDayKey(op.habitUuid, op.localDay)
                }
                FailureAction.Retry, FailureAction.RetryCounted -> {
                    if (action == FailureAction.RetryCounted && !fenced(token) { outbox.recordFailure(op.id) }) {
                        return done(SyncResult.SignedOut)
                    }
                    // FIFO: later ops may build on this one, so nothing overtakes it.
                    return done(SyncResult.Retry)
                }
                // The interceptor has signed out, which clears the outbox.
                FailureAction.Stop -> return done(SyncResult.SignedOut)
            }
        }
    }

    /**
     * Gives up on [op]. A refused create also loses its optimistic row (its children, whose ops
     * follow and fail the same way, go with it); anything else is repaired by the pulls after the
     * flush.
     */
    private suspend fun drop(op: OutboxEntity) {
        outbox.delete(op.id)
        val uuid = op.createdUuid() ?: return
        val sessions = db.sessionDao()
        when (op.type) {
            OutboxOpType.CreateSession -> if (sessions.deleteSession(uuid) > 0) {
                db.dayLogDao().addSessions(op.habitUuid, op.localDay, -1)
            }
            OutboxOpType.CreateExerciseLog -> sessions.deleteLog(uuid)
            OutboxOpType.CreatePerformance -> sessions.deleteSet(uuid)
            else -> Unit
        }
    }

    /** After a flush that dropped ops: pulls today, and the sessions of the days they touched. */
    private suspend fun repairLocked(token: String, flushed: Flushed): SyncResult {
        var result = pullLocked(token)
        for (day in flushed.sessionDays) {
            if (result == SyncResult.SignedOut) break
            result = worse(result, pullSessionsLocked(token, day))
        }
        return result
    }

    private suspend fun pullSessionsLocked(token: String, day: HabitDayKey): SyncResult =
        when (val sessions = safeCall { trackerService.sessions(day.habitUuid, day.localDay) }) {
            is ApiResult.Success ->
                if (fenced(token) { db.syncDao().applySessions(day.habitUuid, day.localDay, sessions.value) }) SyncResult.Done else SyncResult.SignedOut
            is ApiResult.Failure -> sessions.error.toPullResult()
        }

    private suspend fun pullExercisesLocked(token: String): SyncResult {
        val now = clock.instant()
        return pullWithLocked(token, { exerciseService.exercises() }) { db.syncDao().applyExercises(it, now) }
    }

    /** Pulls each of [parts] in turn; one that fails doesn't stop the others. */
    private suspend fun pullConfigLocked(token: String, parts: Collection<ConfigPart>): SyncResult {
        var result = SyncResult.Done
        for (part in parts) {
            val now = clock.instant()
            val dao = db.syncDao()
            result = worse(
                result,
                when (part) {
                    ConfigPart.Habits -> pullWithLocked(token, { habitsService.habits() }) { dao.applyHabits(it, now) }
                    ConfigPart.Exercises -> pullExercisesLocked(token)
                    ConfigPart.Lists -> pullWithLocked(token, { listService.lists() }) { dao.applyLists(it, now) }
                    ConfigPart.MuscleGroups -> pullWithLocked(token, { exerciseService.muscleGroups() }) { dao.applyMuscleGroups(it, now) }
                    ConfigPart.Limits -> pullWithLocked(token, { meService.limits() }) { dao.applyLimits(it, now) }
                },
            )
            if (result == SyncResult.SignedOut) break
        }
        return result
    }

    /** Fetches with [call] and, if the session is still [token]'s, stores the answer with [apply]. */
    private suspend fun <T> pullWithLocked(token: String, call: suspend () -> T, apply: suspend (T) -> Unit): SyncResult =
        when (val answer = safeCall(call)) {
            is ApiResult.Success -> if (fenced(token) { apply(answer.value) }) SyncResult.Done else SyncResult.SignedOut
            is ApiResult.Failure -> answer.error.toPullResult()
        }

    private suspend fun pullSourcesLocked(token: String): SyncResult =
        when (val sources = safeCall { exerciseService.sources() }) {
            is ApiResult.Success -> if (fenced(token) { db.syncDao().applySources(sources.value) }) SyncResult.Done else SyncResult.SignedOut
            is ApiResult.Failure -> sources.error.toPullResult()
        }

    private suspend fun pullQueueLocked(token: String, key: String): SyncResult {
        val queue = when (val answer = safeCall { exerciseService.source(key) }) {
            is ApiResult.Success -> answer.value
            is ApiResult.Failure -> if (answer.error is ApiError.NotFound) null else return answer.error.toPullResult()
        }
        return if (fenced(token) { db.syncDao().applyQueue(key, queue, clock.instant()) }) SyncResult.Done else SyncResult.SignedOut
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

        /**
         * How long a pulled part of the config counts as fresh for [sync]. The config screens pull
         * their parts whenever they open; this keeps Room's copy usable offline.
         */
        val CONFIG_MAX_AGE: Duration = Duration.ofHours(1)

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
