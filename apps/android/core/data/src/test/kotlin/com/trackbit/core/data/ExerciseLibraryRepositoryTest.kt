package com.trackbit.core.data

import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseMediaRef
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
import com.trackbit.core.model.RecentLog
import com.trackbit.core.model.SetValues
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
import java.time.LocalDate

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

    private val request = ExerciseRequest(
        "Dips", null, ExerciseCategory.Strength, listOf(1),
        instructions = null, tips = null, commonMistakes = null, equipment = emptyList(), difficulty = null, variantOfUuid = null,
        uuid = ex(100),
    )

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

    @Test fun `the info fields survive Room`() = runTest {
        val info = exercise(10).copy(
            instructions = listOf("Hinge", "Stand up"),
            tips = null,
            commonMistakes = listOf("Rounding the back"),
            equipment = listOf("barbell"),
            difficulty = "advanced",
            variantOfUuid = ex(11),
            recentLogs = listOf(serverLog("l-old", DAY.minusDays(7))),
            media = listOf(ExerciseMediaRef("m-1", "https://blob.test/a.webp", animated = true, width = 4, height = 3, alt = null)),
        )
        db.syncDao().applyExercises(listOf(info, exercise(11)), clock.instant())

        assertEquals(info, repository.exercises().first()?.first { it.uuid == ex(10) })
        assertEquals(exercise(11), repository.exercises().first()?.first { it.uuid == ex(11) })
    }

    private fun serverLog(uuid: String, day: LocalDate, reps: Int = 5) =
        RecentLog(uuid, day, listOf(SetValues(reps, 20.0, null, null, null)))

    /** A session on [day] with one log of exercise 10 holding sets of [reps], given out of order. */
    private suspend fun localLog(uuid: String, day: LocalDate, vararg reps: Int) {
        val sets = reps.mapIndexed { i, r -> ExercisePerformance(0, "p-$uuid-$i", i + 1, 0, r, 20.0, null, null, null, Instant.EPOCH) }
        val log = ExerciseLogDetail(
            id = 0, uuid = uuid, exerciseUuid = ex(10), listItemUuid = null, createdAt = Instant.EPOCH,
            distance = null, duration = null, distanceUnit = null, weightUnit = null, exercisePerformances = sets.reversed(),
        )
        db.syncDao().applySessions(h(1), day, listOf(ExerciseSessionDetail(0, "s-$uuid", 0, Instant.EPOCH, listOf(log))))
    }

    private suspend fun serverLogs(vararg logs: RecentLog) =
        db.syncDao().applyExercises(listOf(exercise(10).copy(recentLogs = logs.toList()), exercise(11)), clock.instant())

    @Test fun `last time is the server's latest log, skipping the one the sheet was opened from`() = runTest {
        assertNull(repository.lastTime(ex(10), null).first())
        serverLogs(serverLog("l-2", DAY.minusDays(2)), serverLog("l-1", DAY.minusDays(5)))

        assertEquals("l-2", repository.lastTime(ex(10), null).first()?.uuid)
        assertEquals("l-1", repository.lastTime(ex(10), exceptLogUuid = "l-2").first()?.uuid)
    }

    @Test fun `a newer log in Room wins, with its sets in order`() = runTest {
        serverLogs(serverLog("l-server", DAY.minusDays(5)))
        localLog("l-offline", DAY.minusDays(1), 8, 6, 4)

        val last = repository.lastTime(ex(10), null).first()
        assertEquals("l-offline", last?.uuid)
        assertEquals(DAY.minusDays(1), last?.localDay)
        assertEquals(listOf(8, 6, 4), last?.sets?.map { it.reps })
    }

    @Test fun `Room's copy of the same day wins, an older one loses`() = runTest {
        serverLogs(serverLog("l-1", DAY.minusDays(1), reps = 5))
        localLog("l-1", DAY.minusDays(1), 9)
        assertEquals(listOf(9), repository.lastTime(ex(10), null).first()?.sets?.map { it.reps })

        localLog("l-old", DAY.minusDays(9), 3)
        serverLogs(serverLog("l-new", DAY.minusDays(1)))
        db.syncDao().applySessions(h(1), DAY.minusDays(1), emptyList())
        assertEquals("l-new", repository.lastTime(ex(10), null).first()?.uuid)
    }

    @Test fun `the open log and logs without sets are skipped in Room too`() = runTest {
        localLog("l-today", DAY, 5)
        localLog("l-empty", DAY.minusDays(1))
        localLog("l-before", DAY.minusDays(2), 7)

        assertEquals("l-today", repository.lastTime(ex(10), null).first()?.uuid)
        assertEquals("l-before", repository.lastTime(ex(10), exceptLogUuid = "l-today").first()?.uuid)
    }
}
