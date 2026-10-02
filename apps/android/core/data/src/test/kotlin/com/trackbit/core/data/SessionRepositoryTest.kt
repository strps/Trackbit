package com.trackbit.core.data

import com.trackbit.core.data.FakeTrackerService.Deleted
import com.trackbit.core.data.FakeTrackerService.Updated
import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.model.CreateExerciseLogRequest
import com.trackbit.core.model.CreatePerformanceRequest
import com.trackbit.core.model.CreateSessionRequest
import com.trackbit.core.model.ExerciseLogDetail
import com.trackbit.core.model.ExercisePerformance
import com.trackbit.core.model.ExerciseSessionDetail
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.LastPerformance
import com.trackbit.core.model.Prescription
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.model.SetValues
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException
import java.time.Instant

/** Sessions, logs and sets: optimistic writes, their ops, and pulls of a day's sessions. */
@RunWith(RobolectricTestRunner::class)
class SessionRepositoryTest {
    private val db = inMemoryDatabase()
    private val service = FakeTrackerService()
    /** Exercise 10 was last done (on the server) for 5 reps of 40 kg, a day before [DAY]. */
    private val lastTime = LastPerformance(1, weight = 40.0, reps = 5, distance = null, duration = null, createdAt = Instant.parse("2026-09-25T10:00:00Z"), rpe = 7)
    private val exercises = FakeExerciseService { listOf(exercise(10, lastPerformance = lastTime), exercise(11, frozen = true)) }
    private val tokens = FakeTokens()
    private val scheduler = FakeScheduler()
    private val clock = FakeClock()
    private val sync = TrackerSync(db, service, exercises, tokens, clock)
    private val repository = DefaultSessionRepository(db, sync, scheduler, clock)

    private val gym = todayHabit(1, type = HabitType.Complex)

    @Before fun seed() = runTest {
        db.syncDao().applyToday(todayResponse(DAY, gym, todayHabit(2), todayHabit(3, type = HabitType.Complex, frozen = true)))
        service.todayAnswer = { todayResponse(DAY, gym, todayHabit(2), todayHabit(3, type = HabitType.Complex, frozen = true)) }
        db.syncDao().applyExercises(exercises.answer())
    }

    @After fun close() = db.close()

    private suspend fun sessions() = repository.observeSessions(1, DAY).first()
    private suspend fun sessionCount() = db.dayLogDao().get(1, DAY)?.sessionCount ?: 0

    /** Starts a session, adds exercise 10 and one set: what a first workout queues. */
    private suspend fun workout(): TrackedSet {
        repository.startSession(1, DAY)
        repository.addExercise(sessions().single().id, 10)
        repository.addSet(sessions().single().logs.single().id)
        return sessions().single().logs.single().sets.single()
    }

    @Test fun `a workout shows at once and its ops name every row by uuid`() = runTest {
        val set = workout()

        val session = sessions().single()
        val log = session.logs.single()
        assertEquals(1, sessionCount())
        assertEquals(10, log.exerciseId)
        assertEquals(TrackedSet(set.id, 1, LAST_TIME), set)
        assertEquals(3, scheduler.flushes)

        assertEquals(SyncResult.Done, sync.flush())
        assertEquals(
            listOf(
                CreateSessionRequest(session.id, 1, DAY),
                CreateExerciseLogRequest(log.id, session.id, 10, listItemId = null),
                CreatePerformanceRequest(set.id, log.id, 1, LAST_TIME),
            ),
            service.sent.map { it.body },
        )
        assertEquals("every op has its own key", 3, service.sent.map { it.key }.toSet().size)
        assertEquals(0, db.outboxDao().observeCount().first())
        assertEquals("confirming changes nothing on screen", session, sessions().single())
    }

    @Test fun `sets are numbered after the log's last one, and edits and deletes are queued`() = runTest {
        val first = workout()
        val logId = sessions().single().logs.single().id
        repository.addSet(logId)
        val second = sessions().single().logs.single().sets[1]
        assertEquals(2, second.number)

        val edited = SetValues(reps = 8, weight = 60.5, duration = null, distance = null, rpe = 7)
        assertEquals(WriteResult.Queued, repository.updateSet(first.id, edited))
        assertEquals(WriteResult.Queued, repository.deleteSet(second.id))

        assertEquals(listOf(TrackedSet(first.id, 1, edited)), sessions().single().logs.single().sets)
        sync.flush()
        assertEquals(listOf(Updated(first.id, edited), Deleted("set", second.id)), service.sent.drop(4).map { it.body })
    }

    @Test fun `a new set starts from the newer of the latest local set and the catalog's last performance`() = runTest {
        val first = workout()
        val logId = sessions().single().logs.single().id
        val edited = SetValues(reps = 8, weight = 42.5, duration = null, distance = null, rpe = 9)
        repository.updateSet(first.id, edited)

        clock.advanceMs(1_000)
        repository.addSet(logId)
        assertEquals("the local set is newer", edited, sessions().single().logs.single().sets[1].values)

        // A set logged elsewhere after this one reaches the catalog with a refresh.
        val newer = lastTime.copy(reps = 12, weight = 30.0, rpe = null, createdAt = clock.now.plusSeconds(60))
        exercises.answer = { listOf(exercise(10, lastPerformance = newer)) }
        db.syncDao().applyExercises(exercises.answer())
        repository.addSet(logId)
        assertEquals(SetValues(reps = 12, weight = 30.0, duration = null, distance = null, rpe = null), sessions().single().logs.single().sets[2].values)

        repository.startSession(1, DAY)
        repository.addExercise(sessions()[1].id, 12)
        repository.addSet(sessions()[1].logs.single().id)
        assertEquals("never done: empty", SetValues.EMPTY, sessions()[1].logs.single().sets.single().values)
    }

    @Test fun `deleting a session takes its logs and the day's count with it`() = runTest {
        workout()
        val session = sessions().single()

        repository.deleteSession(session.id)

        assertEquals(emptyList<TrackedSession>(), sessions())
        assertEquals(0, sessionCount())
        assertEquals("gone already", WriteResult.NoChange, repository.removeExercise(session.logs.single().id))
        sync.flush()
        assertEquals(Deleted("session", session.id), service.sent.last().body)
    }

    @Test fun `a delete answered with 404 is done`() = runTest {
        workout()
        sync.flush()
        repository.deleteSession(sessions().single().id)
        service.sessionRespond = { if (it is Deleted) throw httpError(404) }

        assertEquals(SyncResult.Done, sync.flush())
        assertEquals(0, db.outboxDao().observeCount().first())
        assertEquals(emptyList<Any>(), service.sessionsRequests)
    }

    @Test fun `a refused create loses its row, its children fail with it, and the day is pulled`() = runTest {
        workout()
        service.sessionRespond = { body ->
            when (body) {
                is CreateSessionRequest -> throw httpError(403, """{"error":"habit_frozen","habitId":1}""")
                // The server never saw the session, so its children are 404s.
                else -> throw httpError(404)
            }
        }

        sync.flush()

        assertEquals(emptyList<TrackedSession>(), sessions())
        assertEquals(0, sessionCount())
        assertEquals(0, db.outboxDao().observeCount().first())
        assertEquals(listOf(1 to DAY), service.sessionsRequests)
    }

    @Test fun `frozen habits and frozen exercises refuse writes, and only complex habits start sessions`() = runTest {
        assertEquals(WriteResult.HabitFrozen, repository.startSession(3, DAY))
        assertEquals(WriteResult.NoChange, repository.startSession(2, DAY))
        assertEquals(WriteResult.HabitNotFound, repository.startSession(99, DAY))

        repository.startSession(1, DAY)
        assertEquals(WriteResult.ExerciseFrozen, repository.addExercise(sessions().single().id, 11))
        assertEquals("not in the catalog yet: the server decides", WriteResult.Queued, repository.addExercise(sessions().single().id, 12))
        assertEquals(1, sessions().single().logs.size)
    }

    @Test fun `refresh replaces the day's sessions and the catalog`() = runTest {
        val server = ExerciseSessionDetail(
            id = 7, uuid = "s-1", dayLogId = 3, createdAt = Instant.EPOCH,
            exerciseLogs = listOf(
                ExerciseLogDetail(
                    id = 8, uuid = "l-1", exerciseId = 10, listItemId = 4, createdAt = Instant.EPOCH,
                    distance = null, duration = null, distanceUnit = "km", weightUnit = "kg",
                    exercisePerformances = listOf(
                        ExercisePerformance(9, "p-2", 2, 8, reps = 6, weight = 20.0, duration = null, distance = null, rpe = null, createdAt = Instant.EPOCH.plusSeconds(1)),
                        ExercisePerformance(10, "p-1", 1, 8, reps = 5, weight = 20.0, duration = null, distance = null, rpe = 8, createdAt = Instant.EPOCH),
                    ),
                ),
            ),
        )
        service.sessionsAnswer = { _, _ -> listOf(server) }
        exercises.answer = { listOf(exercise(10)) }

        assertEquals(SyncResult.Done, repository.refresh(1, DAY))

        val session = sessions().single()
        assertEquals("s-1", session.id)
        assertEquals(4, session.logs.single().listItemId)
        assertEquals(listOf("p-1", "p-2"), session.logs.single().sets.map { it.id })
        assertEquals(1, sessionCount())
        assertEquals(listOf(10), repository.observeExercises().first().map { it.id })
    }

    @Test fun `a pull leaves a day with pending ops alone`() = runTest {
        service.sessionRespond = { throw IOException("offline") }
        workout()

        assertEquals(SyncResult.Retry, repository.refresh(1, DAY))

        assertEquals("pulled, but the empty answer is ignored", listOf(1 to DAY), service.sessionsRequests)
        assertEquals(1, sessions().single().logs.single().sets.size)
        assertEquals(1, sessionCount())
    }

    @Test fun `a pull that outlives the session writes nothing`() = runTest {
        service.sessionsAnswer = { _, _ ->
            tokens.token = null
            listOf(ExerciseSessionDetail(1, "s-1", 1, Instant.EPOCH, emptyList()))
        }

        assertEquals(SyncResult.SignedOut, repository.refresh(1, DAY))
        assertEquals(emptyList<TrackedSession>(), sessions())
    }

    @Test fun `a new set of a prescribed list item starts from its targets, the rest from last time`() = runTest {
        // Item 4 prescribes 8 reps and 90 s, item 5 nothing; RPE is never prescribed.
        val rx = Prescription(targetSets = 3, targetReps = 8, targetWeight = null, targetDuration = 90, targetDistance = null, restSeconds = 60, notes = null)
        exercises.queueAnswer = { key -> queue(key, QueueEntry(10, 0, 4, rx), QueueEntry(10, 1, 5, null)) }
        assertEquals(SyncResult.Done, repository.refreshQueue("list:1"))

        repository.startSession(1, DAY)
        val sessionId = sessions().single().id
        repository.addExercise(sessionId, 10, listItemId = 4)
        repository.addSet(sessions().single().logs.single().id)
        assertEquals(LAST_TIME.copy(reps = 8, duration = 90_000), sessions().single().logs.single().sets.single().values)

        repository.addExercise(sessionId, 10, listItemId = 5)
        val unprescribed = sessions().single().logs.single { it.listItemId == 5 }
        repository.addSet(unprescribed.id)
        assertEquals(LAST_TIME.copy(reps = 8, duration = 90_000), sessions().single().logs.single { it.listItemId == 5 }.sets.single().values)
    }

    @Test fun `refresh pulls the sources, and a queue is pulled on its own`() = runTest {
        exercises.sourcesAnswer = { listOf(source("list:2", "Legs"), source("list:1", "Pull")) }
        exercises.queueAnswer = { key -> queue(key, QueueEntry(10, 0, 4, null)) }

        assertEquals(SyncResult.Done, repository.refresh(1, DAY))
        assertEquals(listOf("Legs", "Pull"), repository.observeSources().first().map { it.name })
        assertEquals(null, repository.observeQueue("list:1").first())

        assertEquals(SyncResult.Done, repository.refreshQueue("list:1"))
        assertEquals(SourceQueue.Resolved(listOf(QueueEntry(10, 0, 4, null)), null), repository.observeQueue("list:1").first())
    }

    @Test fun `a queue that answers 404 is gone, and offline keeps the last copy`() = runTest {
        exercises.queueAnswer = { key -> queue(key, QueueEntry(10, 0, 4, null)) }
        repository.refreshQueue("list:1")

        exercises.queueAnswer = { throw IOException("offline") }
        assertEquals(SyncResult.Retry, repository.refreshQueue("list:1"))
        assertEquals(SourceQueue.Resolved(listOf(QueueEntry(10, 0, 4, null)), null), repository.observeQueue("list:1").first())

        exercises.queueAnswer = { throw httpError(404) }
        assertEquals(SyncResult.Done, repository.refreshQueue("list:1"))
        assertEquals(SourceQueue.Gone, repository.observeQueue("list:1").first())
    }

    @Test fun `a queue pulled after sign-out writes nothing`() = runTest {
        exercises.queueAnswer = { key ->
            tokens.token = null
            queue(key, QueueEntry(10, 0, 4, null))
        }
        assertEquals(SyncResult.SignedOut, repository.refreshQueue("list:1"))
        tokens.token = "t1"
        assertEquals(null, repository.observeQueue("list:1").first())
    }

    private companion object {
        val LAST_TIME = SetValues(reps = 5, weight = 40.0, duration = null, distance = null, rpe = 7)
    }
}
