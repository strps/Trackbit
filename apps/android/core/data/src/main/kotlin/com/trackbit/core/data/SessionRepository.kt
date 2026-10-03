package com.trackbit.core.data

import androidx.room.withTransaction
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.sync.SetUpdate
import com.trackbit.core.data.sync.SyncScheduler
import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.data.sync.createExerciseLogOp
import com.trackbit.core.data.sync.createPerformanceOp
import com.trackbit.core.data.sync.createSessionOp
import com.trackbit.core.data.sync.deleteOp
import com.trackbit.core.data.sync.updatePerformanceOp
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.database.dao.HabitDayKey
import com.trackbit.core.database.entity.ExerciseLogEntity
import com.trackbit.core.database.entity.LogWithSets
import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.database.entity.OutboxOpType
import com.trackbit.core.database.entity.PerformanceEntity
import com.trackbit.core.database.entity.SessionEntity
import com.trackbit.core.database.entity.SessionWithLogs
import com.trackbit.core.model.CreateExerciseLogRequest
import com.trackbit.core.model.CreatePerformanceRequest
import com.trackbit.core.model.CreateSessionRequest
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.Prescription
import com.trackbit.core.model.QueueEmptyReason
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.SetValues
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import javax.inject.Inject

/**
 * Exercise sessions of complex habits, with their logs (one exercise each) and sets. Like
 * [TrackerRepository]: reads come from Room only, and writes change Room at once and queue an
 * outbox op in the same transaction. Rows are named by uuids the app picks, so a whole workout
 * can be logged offline.
 *
 * A day's sessions are in Room once [refresh] has pulled them, or as far as this device wrote them.
 */
interface SessionRepository {
    /** [habitId]'s sessions on [day], oldest first, each with its logs and sets in order. */
    fun observeSessions(habitId: Int, day: LocalDate): Flow<List<TrackedSession>>

    /** The exercise catalog as of the last [refresh]: system exercises and the user's own, by name. */
    fun observeExercises(): Flow<List<Exercise>>

    /** The picker's exercise sources as of the last [refresh], in the server's order. */
    fun observeSources(): Flow<List<ExerciseSourceDescriptor>>

    /** [key]'s queue as of its last [refreshQueue]; null if it was never pulled. */
    fun observeQueue(key: String): Flow<SourceQueue?>

    /**
     * Sends pending writes, then reloads [habitId]'s sessions on [day] (unless writes to that day
     * are still pending), the exercise catalog and the sources. For opening a session screen and
     * pull-to-refresh.
     */
    suspend fun refresh(habitId: Int, day: LocalDate): SyncResult

    /** Reloads [key]'s queue. */
    suspend fun refreshQueue(key: String): SyncResult

    /** Starts a session on [day], whose session count goes up at once. Complex habits only. */
    suspend fun startSession(habitId: Int, day: LocalDate): WriteResult

    /** Deletes a session with its logs and sets. [WriteResult.NoChange]: it is already gone. */
    suspend fun deleteSession(sessionId: String): WriteResult

    /**
     * Adds [exerciseId] to a session. [listItemId] is the exercise-list item it was picked from,
     * if any (provenance for adherence).
     */
    suspend fun addExercise(sessionId: String, exerciseId: Int, listItemId: Int? = null): WriteResult

    /** Removes an exercise from its session, with its sets. */
    suspend fun removeExercise(logId: String): WriteResult

    /**
     * Adds a set after the log's last one, with the values the web's `buildNewSetValues` picks:
     * each prescribed target of the list item the log came from (if a cached queue holds it),
     * else the exercise's last performance, the newer of its latest set in Room and the
     * catalog's. RPE is an outcome, so it only ever comes from the last performance.
     *
     * Adding a set means it was done, so it also starts the rest timer ([RestTimerRepository]),
     * replacing a running one: the list item's prescribed rest, else the user's default. A rest
     * of 0 only ends the running one.
     */
    suspend fun addSet(logId: String): WriteResult

    /** Replaces a set's values; a null clears that field. */
    suspend fun updateSet(setId: String, values: SetValues): WriteResult

    suspend fun deleteSet(setId: String): WriteResult
}

/** A source's queue as last pulled. */
sealed interface SourceQueue {
    /** [emptyReason] says why [entries] is empty, when it is. */
    data class Resolved(val entries: List<QueueEntry>, val emptyReason: QueueEmptyReason?) : SourceQueue

    /** The server no longer resolves it (a deleted list): the picker falls back to browse mode. */
    data object Gone : SourceQueue
}

/** One exercise session, as the session screen shows it. */
data class TrackedSession(
    val id: String,
    val habitId: Int,
    val day: LocalDate,
    val createdAt: Instant,
    val logs: List<TrackedExerciseLog>,
)

data class TrackedExerciseLog(
    val id: String,
    val exerciseId: Int,
    /** The exercise-list item it was picked from, or null for an ad-hoc pick. */
    val listItemId: Int?,
    val distance: Double?,
    /** Seconds. */
    val duration: Int?,
    val distanceUnit: String?,
    val weightUnit: String?,
    val sets: List<TrackedSet>,
)

data class TrackedSet(
    val id: String,
    /** Its place in the log, from 1. */
    val number: Int,
    val values: SetValues,
)

internal class DefaultSessionRepository @Inject constructor(
    private val db: TrackbitDatabase,
    private val sync: TrackerSync,
    scheduler: SyncScheduler,
    private val clock: Clock,
    private val auth: AuthRepository,
) : SessionRepository {
    private val sessionDao = db.sessionDao()
    private val exerciseDao = db.exerciseDao()
    private val sourceDao = db.sourceDao()
    private val habitDao = db.habitDao()
    private val dayLogDao = db.dayLogDao()
    private val timerDao = db.timerDao()
    private val writer = OutboxWriter(db, scheduler)

    override fun observeSessions(habitId: Int, day: LocalDate): Flow<List<TrackedSession>> =
        sessionDao.observeDay(habitId, day).map { sessions ->
            sessions.sortedWith(compareBy({ it.session.createdAt }, { it.session.uuid })).map { it.toTracked() }
        }

    override fun observeExercises(): Flow<List<Exercise>> =
        exerciseDao.observeAll().map { exercises -> exercises.map { it.toExercise() } }

    override fun observeSources(): Flow<List<ExerciseSourceDescriptor>> =
        sourceDao.observeSources().map { sources -> sources.map { it.toDescriptor() } }

    override fun observeQueue(key: String): Flow<SourceQueue?> = sourceDao.observeQueue(key).map { cached ->
        when {
            cached == null -> null
            cached.queue.gone -> SourceQueue.Gone
            else -> SourceQueue.Resolved(cached.entries.sortedBy { it.ordinal }.map { it.toEntry() }, cached.queue.emptyReason)
        }
    }

    override suspend fun refresh(habitId: Int, day: LocalDate): SyncResult = sync.syncSessions(habitId, day)

    override suspend fun refreshQueue(key: String): SyncResult = sync.syncQueue(key)

    override suspend fun startSession(habitId: Int, day: LocalDate): WriteResult = writer.write(habitId) {
        if (habitDao.get(habitId)?.type != HabitType.Complex) return@write null
        val uuid = newUuid()
        sessionDao.insert(SessionEntity(uuid, habitId, day, clock.instant()))
        // The server makes the day's log with the first session.
        dayLogDao.addSessions(habitId, day, 1)
        createSessionOp(CreateSessionRequest(uuid, habitId, day))
    }

    override suspend fun deleteSession(sessionId: String): WriteResult = writeTo({ sessionDao.sessionDay(sessionId) }) { day ->
        sessionDao.deleteSession(sessionId)
        dayLogDao.addSessions(day.habitId, day.localDay, -1)
        deleteOp(OutboxOpType.DeleteSession, day, sessionId)
    }

    override suspend fun addExercise(sessionId: String, exerciseId: Int, listItemId: Int?): WriteResult =
        writeTo({ sessionDao.sessionDay(sessionId) }, exerciseId = { exerciseId }) { day ->
            val uuid = newUuid()
            sessionDao.insert(
                ExerciseLogEntity(
                    uuid = uuid,
                    sessionUuid = sessionId,
                    exerciseId = exerciseId,
                    listItemId = listItemId,
                    createdAt = clock.instant(),
                    distance = null,
                    duration = null,
                    distanceUnit = null,
                    weightUnit = null,
                ),
            )
            createExerciseLogOp(day, CreateExerciseLogRequest(uuid, sessionId, exerciseId, listItemId))
        }

    override suspend fun removeExercise(logId: String): WriteResult = writeTo({ sessionDao.logDay(logId) }) { day ->
        sessionDao.deleteLog(logId)
        deleteOp(OutboxOpType.DeleteExerciseLog, day, logId)
    }

    override suspend fun addSet(logId: String): WriteResult =
        writeTo({ sessionDao.logDay(logId) }, exerciseId = { sessionDao.exerciseOfLog(logId) }) { day ->
            val uuid = newUuid()
            val prescription = sessionDao.listItemOfLog(logId)?.let { sourceDao.prescription(it) }
            val values = newSetValues(prescription, checkNotNull(sessionDao.exerciseOfLog(logId)))
            // Like the web: one more than the sets the log has now.
            val number = sessionDao.setCount(logId) + 1
            sessionDao.insert(
                PerformanceEntity(
                    uuid = uuid,
                    logUuid = logId,
                    number = number,
                    reps = values.reps,
                    weight = values.weight,
                    duration = values.duration,
                    distance = values.distance,
                    rpe = values.rpe,
                    createdAt = clock.instant(),
                ),
            )
            startRest(prescription?.restSeconds ?: defaultRestSeconds())
            createPerformanceOp(day, CreatePerformanceRequest(uuid, logId, number, values))
        }

    override suspend fun updateSet(setId: String, values: SetValues): WriteResult =
        writeTo({ sessionDao.setDay(setId) }, exerciseId = { sessionDao.exerciseOfSet(setId) }) { day ->
            sessionDao.updateSet(setId, values.reps, values.weight, values.duration, values.distance, values.rpe)
            updatePerformanceOp(day, SetUpdate(setId, values))
        }

    override suspend fun deleteSet(setId: String): WriteResult = writeTo({ sessionDao.setDay(setId) }) { day ->
        sessionDao.deleteSet(setId)
        deleteOp(OutboxOpType.DeletePerformance, day, setId)
    }

    /**
     * A write under an existing row, in one transaction: [day] finds the row's day ([WriteResult.NoChange]
     * if the row is gone), and the write is refused if its habit is frozen, or if the exercise
     * [exerciseId] names is a frozen custom one (the server refuses those as the web does).
     */
    private suspend fun writeTo(
        day: suspend () -> HabitDayKey?,
        exerciseId: suspend () -> Int? = { null },
        change: suspend (HabitDayKey) -> OutboxEntity,
    ): WriteResult = writer.flushIfQueued(
        db.withTransaction {
            val key = day() ?: return@withTransaction WriteResult.NoChange
            val exercise = exerciseId()?.let { exerciseDao.get(it) }
            val habitFrozen = habitDao.get(key.habitId)?.frozen == true
            // The habit's state wins, as on the server.
            if (exercise?.frozen == true && !habitFrozen) return@withTransaction WriteResult.ExerciseFrozen
            writer.queue(key.habitId) { change(key) }
        },
    )

    /** See [SessionRepository.addSet]. Prescribed durations are seconds; sets store ms. */
    private suspend fun newSetValues(prescription: Prescription?, exerciseId: Int): SetValues {
        val last = lastPerformance(exerciseId)
        if (prescription == null) return last
        return SetValues(
            reps = prescription.targetReps ?: last.reps,
            weight = prescription.targetWeight ?: last.weight,
            duration = prescription.targetDuration?.let { it * 1000 } ?: last.duration,
            distance = prescription.targetDistance ?: last.distance,
            rpe = last.rpe,
        )
    }

    /**
     * The newer of [exerciseId]'s latest set in Room (which may not have reached the server yet)
     * and the catalog's last performance (which may be from a day Room doesn't hold). RPE comes
     * along: it is an outcome, and the last one is the best guess.
     */
    private suspend fun lastPerformance(exerciseId: Int): SetValues {
        val local = sessionDao.latestSet(exerciseId)
        val remote = exerciseDao.get(exerciseId)?.lastPerformance
        val remoteAt = remote?.createdAt
        return when {
            local != null && (remote == null || remoteAt == null || !remoteAt.isAfter(local.createdAt)) ->
                SetValues(local.reps, local.weight, local.duration, local.distance, local.rpe)
            remote != null -> SetValues(remote.reps, remote.weight, remote.duration, remote.distance, remote.rpe)
            else -> SetValues.EMPTY
        }
    }

    private suspend fun startRest(seconds: Int) {
        if (seconds <= 0) {
            timerDao.deleteRest()
            return
        }
        val now = clock.instant()
        timerDao.replaceRest(startedAt = now, endsAt = now.plusSeconds(seconds.toLong()))
    }

    // A write needs a signed-in user, so the fallback is never used.
    private fun defaultRestSeconds(): Int =
        (auth.state.value as? AuthState.SignedIn)?.user?.defaultRestSeconds ?: SessionUser.DEFAULT_REST_SECONDS

    private fun newUuid() = UUID.randomUUID().toString()
}

private fun SessionWithLogs.toTracked() = TrackedSession(
    id = session.uuid,
    habitId = session.habitId,
    day = session.localDay,
    createdAt = session.createdAt,
    logs = logs.sortedWith(compareBy({ it.log.createdAt }, { it.log.uuid })).map { it.toTracked() },
)

private fun LogWithSets.toTracked() = TrackedExerciseLog(
    id = log.uuid,
    exerciseId = log.exerciseId,
    listItemId = log.listItemId,
    distance = log.distance,
    duration = log.duration,
    distanceUnit = log.distanceUnit,
    weightUnit = log.weightUnit,
    sets = sets.sortedWith(compareBy({ it.createdAt }, { it.number }, { it.uuid })).map {
        TrackedSet(it.uuid, it.number, SetValues(it.reps, it.weight, it.duration, it.distance, it.rpe))
    },
)
