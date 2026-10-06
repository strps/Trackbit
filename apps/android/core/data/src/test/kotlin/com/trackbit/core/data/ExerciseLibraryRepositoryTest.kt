package com.trackbit.core.data

import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseListItem
import com.trackbit.core.model.ExerciseLogDetail
import com.trackbit.core.model.ExercisePerformance
import com.trackbit.core.model.ExerciseRequest
import com.trackbit.core.model.ExerciseSessionDetail
import com.trackbit.core.model.HabitSet
import com.trackbit.core.model.HabitSetsResponse
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.MuscleGroup
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.network.service.ExerciseService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.job
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException
import java.time.Instant

/**
 * The library reads Room's catalog. Its writes go to the server first and store the answer;
 * Room's caches follow once they succeed.
 */
@RunWith(RobolectricTestRunner::class)
class ExerciseLibraryRepositoryTest {
    private val db = inMemoryDatabase()
    private val exercises = FakeExerciseService { listOf(exercise(10), exercise(11)) }
    private val tokens = FakeTokens()
    private val clock = FakeClock()
    private val sync = trackerSync(db, exercises = exercises, tokens = tokens, clock = clock)
    private val scope = CoroutineScope(Job() + Dispatchers.Unconfined)
    private val repository = DefaultExerciseLibraryRepository(db, exercises, sync, scope)
    private val sessions = DefaultSessionRepository(db, sync, FakeScheduler(), clock, FakeAuth())

    private val request = ExerciseRequest("Dips", null, ExerciseCategory.Strength, listOf(1), uuid = ex(100))

    @Before fun seed() = runTest {
        db.syncDao().applyToday(todayResponse(DAY, todayHabit(1, type = HabitType.Complex)))
        db.syncDao().applyExercises(exercises.answer(), clock.instant())
    }

    /** Background syncs a write started must not outlive the database. */
    @After fun close() {
        runBlocking { synced() }
        db.close()
    }

    /** Waits for the background syncs the writes started. */
    private suspend fun synced() = scope.coroutineContext.job.children.forEach { it.join() }

    private suspend fun catalog() = sessions.observeExercises().first().map { it.uuid }

    @Test fun `the library is Room's catalog with descriptions, once pulled`() = runTest {
        val fresh = inMemoryDatabase()
        val repository = DefaultExerciseLibraryRepository(fresh, exercises, trackerSync(fresh, exercises = exercises), scope)
        assertNull(repository.exercises().first())
        assertNull(repository.muscleGroups().first())
        exercises.answer = { listOf(exercise(10).copy(description = "Hinge")) }
        exercises.muscleGroupsAnswer = { listOf(MuscleGroup(1, "Legs", "legs", null, 1, 0)) }

        assertEquals(SyncResult.Done, repository.refresh())

        assertEquals("Hinge", repository.exercises().first()?.single()?.description)
        assertEquals(listOf("Legs"), repository.muscleGroups().first()?.map { it.name })
        fresh.close()
    }

    @Test fun `a create is sent and its answer goes into Room's catalog`() = runTest {
        val created = repository.create(request) as ConfigResult.Success
        synced()

        assertEquals("Dips", created.value.name)
        assertEquals(listOf<Pair<String?, ExerciseRequest?>>(null to request), exercises.writes)
        assertEquals(listOf(ex(100), ex(10), ex(11)), catalog())
        assertEquals("no pull needed", 0, exercises.calls)
    }

    @Test fun `an update is sent for its uuid, without the create's`() = runTest {
        repository.update(ex(11), request)
        synced()

        assertEquals(listOf<Pair<String?, ExerciseRequest?>>(ex(11) to request.copy(uuid = null)), exercises.writes)
    }

    @Test fun `a delete drops the exercise's logs, sets and queue entries from Room`() = runTest {
        fun log(uuid: String, exercise: Int) = ExerciseLogDetail(
            id = 0, uuid = uuid, exerciseUuid = ex(exercise), listItemUuid = null, createdAt = Instant.EPOCH,
            distance = null, duration = null, distanceUnit = null, weightUnit = null,
            exercisePerformances = listOf(ExercisePerformance(0, "p-$uuid", 1, 0, 5, 20.0, null, null, null, Instant.EPOCH)),
        )
        fun set(exercise: Int) = HabitSet(DAY, ex(exercise), 20.0, reps = 5, rpe = null, duration = null, distance = null)
        db.syncDao().applySessions(h(1), DAY, listOf(ExerciseSessionDetail(1, "s-1", 1, Instant.EPOCH, listOf(log("l-10", 10), log("l-11", 11)))))
        db.syncDao().applySets(HabitSetsResponse(h(1), listOf(set(10), set(11))), clock.instant())
        db.syncDao().applySources(listOf(source("list:1")))
        db.syncDao().applyQueue("list:1", queue("list:1", QueueEntry(ex(10), 0, item(1), null), QueueEntry(ex(11), 1, item(2), null)), clock.instant())
        db.syncDao().applyLists(
            listOf(exerciseList(lst(1), "Legs").copy(items = listOf(ex(10), ex(11)).mapIndexed { i, e -> ExerciseListItem(item(i + 1), e, i, null, null, null, null, null, null, null) })),
            clock.instant(),
        )
        exercises.answer = { listOf(exercise(10)) }
        exercises.sourcesAnswer = { listOf(source("list:1")) }
        exercises.queueAnswer = { key -> queue(key, QueueEntry(ex(10), 0, item(1), null)) }

        assertEquals(ConfigResult.Success(Unit), repository.delete(ex(11)))
        synced()

        assertEquals(listOf<Pair<String?, ExerciseRequest?>>(ex(11) to null), exercises.writes)
        assertEquals(listOf(ex(10)), sessions.observeSessions(h(1), DAY).first().single().logs.map { it.exerciseUuid })
        assertEquals(listOf(ex(10)), db.habitSetDao().observeSets(h(1)).first().map { it.exerciseUuid })
        assertEquals(listOf(ex(10)), (sessions.observeQueue("list:1").first() as SourceQueue.Resolved).entries.map { it.exerciseUuid })
        assertEquals(listOf(ex(10)), db.configDao().observeLists().first().single().items.map { it.exerciseUuid })
        assertEquals(listOf(ex(10)), catalog())
    }

    @Test fun `a delete that finds the exercise gone counts as done and drops it`() = runTest {
        exercises.answer = { listOf(exercise(10)) }
        val gone = object : ExerciseService by exercises {
            override suspend fun deleteExercise(uuid: String) = throw httpError(404)
        }
        val repository = DefaultExerciseLibraryRepository(db, gone, sync, scope)

        assertEquals(ConfigResult.Success(Unit), repository.delete(ex(11)))
        synced()

        assertEquals(listOf(ex(10)), catalog())
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
        assertEquals(ConfigResult.Failure(ConfigError.CustomExerciseFrozen), repository.update(ex(11), request))
        exercises.writeAnswer = { _, _ -> throw IOException("offline") }
        assertEquals(ConfigResult.Failure(ConfigError.Offline), repository.update(ex(11), request))
        synced()

        assertEquals("no catalog pull after a failure", 0, exercises.calls)
    }
}
