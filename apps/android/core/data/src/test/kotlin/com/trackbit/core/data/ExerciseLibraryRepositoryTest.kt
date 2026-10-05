package com.trackbit.core.data

import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseLogDetail
import com.trackbit.core.model.ExercisePerformance
import com.trackbit.core.model.ExerciseRequest
import com.trackbit.core.model.ExerciseSessionDetail
import com.trackbit.core.model.HabitSet
import com.trackbit.core.model.HabitSetsResponse
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.LimitsResponse
import com.trackbit.core.model.PreferencesRequest
import com.trackbit.core.model.PreferredExerciseSourceRequest
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.network.service.MeService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.job
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException
import java.time.Instant

/** The library's writes go to the server first; Room's catalog and caches follow once they succeed. */
@RunWith(RobolectricTestRunner::class)
class ExerciseLibraryRepositoryTest {
    private val db = inMemoryDatabase()
    private val exercises = FakeExerciseService { listOf(exercise(10), exercise(11)) }
    private val tokens = FakeTokens()
    private val clock = FakeClock()
    private val sync = TrackerSync(db, FakeTrackerService(), exercises, tokens, clock)
    private val scope = CoroutineScope(Job() + Dispatchers.Unconfined)
    private val repository = DefaultExerciseLibraryRepository(exercises, NoMeService, sync, scope)
    private val sessions = DefaultSessionRepository(db, sync, FakeScheduler(), clock, FakeAuth())

    private val request = ExerciseRequest("Dips", null, ExerciseCategory.Strength, listOf(1))

    @Before fun seed() = runTest {
        db.syncDao().applyToday(todayResponse(DAY, todayHabit(1, type = HabitType.Complex)))
        db.syncDao().applyExercises(exercises.answer())
    }

    @After fun close() = db.close()

    /** Waits for the background syncs the writes started. */
    private suspend fun synced() = scope.coroutineContext.job.children.forEach { it.join() }

    private suspend fun catalog() = sessions.observeExercises().first().map { it.id }

    @Test fun `a create is sent, answered, and brings Room's catalog up to date`() = runTest {
        exercises.answer = { listOf(exercise(10), exercise(11), exercise(12)) }

        val created = repository.create(request) as ConfigResult.Success
        synced()

        assertEquals("Dips", created.value.name)
        assertEquals(listOf<Pair<Int?, ExerciseRequest?>>(null to request), exercises.writes)
        assertEquals(listOf(10, 11, 12), catalog())
    }

    @Test fun `an update is sent for its id`() = runTest {
        repository.update(11, request)
        synced()

        assertEquals(listOf<Pair<Int?, ExerciseRequest?>>(11 to request), exercises.writes)
    }

    @Test fun `a delete drops the exercise's logs, sets and queue entries from Room`() = runTest {
        fun log(uuid: String, exerciseId: Int) = ExerciseLogDetail(
            id = 0, uuid = uuid, exerciseId = exerciseId, listItemId = null, createdAt = Instant.EPOCH,
            distance = null, duration = null, distanceUnit = null, weightUnit = null,
            exercisePerformances = listOf(ExercisePerformance(0, "p-$uuid", 1, 0, 5, 20.0, null, null, null, Instant.EPOCH)),
        )
        fun set(exerciseId: Int) = HabitSet(DAY, exerciseId, 20.0, reps = 5, rpe = null, duration = null, distance = null)
        db.syncDao().applySessions(1, DAY, listOf(ExerciseSessionDetail(1, "s-1", 1, Instant.EPOCH, listOf(log("l-10", 10), log("l-11", 11)))))
        db.syncDao().applySets(HabitSetsResponse(1, listOf(set(10), set(11))), clock.instant())
        db.syncDao().applySources(listOf(source("list:1")))
        db.syncDao().applyQueue("list:1", queue("list:1", QueueEntry(10, 0, 1, null), QueueEntry(11, 1, 2, null)), clock.instant())
        exercises.answer = { listOf(exercise(10)) }
        exercises.sourcesAnswer = { listOf(source("list:1")) }

        assertEquals(ConfigResult.Success(Unit), repository.delete(11))
        synced()

        assertEquals(listOf<Pair<Int?, ExerciseRequest?>>(11 to null), exercises.writes)
        assertEquals(listOf(10), sessions.observeSessions(1, DAY).first().single().logs.map { it.exerciseId })
        assertEquals(listOf(10), db.habitSetDao().observeSets(1).first().map { it.exerciseId })
        assertEquals(listOf(10), (sessions.observeQueue("list:1").first() as SourceQueue.Resolved).entries.map { it.exerciseId })
        assertEquals(listOf(10), catalog())
    }

    @Test fun `refused writes map to the screen's errors and leave Room alone`() = runTest {
        fun answer(status: Int, body: String) {
            exercises.writeAnswer = { _, _ -> throw httpError(status, body) }
        }

        answer(403, """{"error":"custom_exercise_limit_reached","maxCustomExercises":5}""")
        assertEquals(ConfigResult.Failure(ConfigError.CustomExerciseLimitReached(5)), repository.create(request))
        answer(409, """{"error":"exercise_name_taken"}""")
        assertEquals(ConfigResult.Failure(ConfigError.ExerciseNameTaken), repository.create(request))
        answer(403, """{"error":"custom_exercise_frozen","exerciseId":11}""")
        assertEquals(ConfigResult.Failure(ConfigError.CustomExerciseFrozen), repository.update(11, request))
        exercises.writeAnswer = { _, _ -> throw IOException("offline") }
        assertEquals(ConfigResult.Failure(ConfigError.Offline), repository.update(11, request))
        synced()

        assertEquals("no catalog pull after a failure", 0, exercises.calls)
    }

    private object NoMeService : MeService {
        override suspend fun updatePreferences(body: PreferencesRequest) = error("unused")
        override suspend fun updatePreferredExerciseSource(body: PreferredExerciseSourceRequest) = error("unused")
        override suspend fun limits(): LimitsResponse = error("unused")
    }
}
