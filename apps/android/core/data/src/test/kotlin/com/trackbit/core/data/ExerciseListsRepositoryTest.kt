package com.trackbit.core.data

import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.model.AppendListItemRequest
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.ExerciseListItemsRequest
import com.trackbit.core.model.ExerciseListItemsResponse
import com.trackbit.core.model.ExerciseListReorderRequest
import com.trackbit.core.model.ExerciseListRequest
import com.trackbit.core.model.ListItemDraft
import com.trackbit.core.model.Prescription
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.network.service.ExerciseListService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.job
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.yield
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException

/** List writes go to the server; Room's sources and cached queues follow once they succeed. */
@RunWith(RobolectricTestRunner::class)
class ExerciseListsRepositoryTest {
    private val db = inMemoryDatabase()
    private val exercises = FakeExerciseService()
    private val lists = FakeExerciseListService()
    private val clock = FakeClock()
    private val sync = TrackerSync(db, FakeTrackerService(), exercises, FakeTokens(), clock)
    private val scope = CoroutineScope(Job() + Dispatchers.Unconfined)
    private val repository = DefaultExerciseListsRepository(lists, sync, scope)
    private val sessions = DefaultSessionRepository(db, sync, FakeScheduler(), clock, FakeAuth())

    @After fun close() = db.close()

    private suspend fun synced() = scope.coroutineContext.job.children.forEach { it.join() }

    private val prescribed = Prescription.NONE.copy(targetSets = 3, targetReps = 8)

    @Test fun `saving items refreshes the sources and every cached queue`() = runTest {
        db.syncDao().applySources(listOf(source("list:1"), source("list:2")))
        db.syncDao().applyQueue("list:1", queue("list:1", QueueEntry(10, 0, 5, null)), clock.instant())
        exercises.sourcesAnswer = { listOf(source("list:1", name = "Legs")) }
        exercises.queueAnswer = { key -> queue(key, QueueEntry(10, 0, 5, prescribed)) }

        val items = listOf(ListItemDraft(5, 10, prescribed), ListItemDraft(null, 11, Prescription.NONE))
        repository.saveItems(1, items)
        synced()

        assertEquals(listOf(1 to ExerciseListItemsRequest.of(items)), lists.writes)
        assertEquals(listOf("Legs"), sessions.observeSources().first().map { it.name })
        val queue = sessions.observeQueue("list:1").first() as SourceQueue.Resolved
        assertEquals(prescribed, queue.entries.single().prescription)
        assertNull("a queue Room never held isn't pulled", sessions.observeQueue("list:2").first())
    }

    @Test fun `each write is sent as such`() = runTest {
        val request = ExerciseListRequest("Legs", null)
        repository.create(request)
        repository.update(2, request)
        repository.reorder(listOf(2, 1))
        repository.append(2, 11)
        repository.delete(1)
        synced()

        assertEquals(
            listOf(null to request, 2 to request, null to ExerciseListReorderRequest(listOf(2, 1)), 2 to AppendListItemRequest(11), 1 to null),
            lists.writes,
        )
    }

    @Test fun `refused writes map to the screen's errors and leave Room alone`() = runTest {
        fun answer(status: Int, body: String) {
            lists.failure = { throw httpError(status, body) }
        }
        val request = ExerciseListRequest("Legs", null)

        answer(403, """{"error":"exercise_list_limit_reached","maxExerciseLists":3}""")
        assertEquals(ConfigResult.Failure(ConfigError.ExerciseListLimitReached(3)), repository.create(request))
        answer(409, """{"error":"exercise_list_name_taken"}""")
        assertEquals(ConfigResult.Failure(ConfigError.ExerciseListNameTaken), repository.update(1, request))
        answer(403, """{"error":"exercise_list_frozen","listId":1}""")
        assertEquals(ConfigResult.Failure(ConfigError.ExerciseListFrozen), repository.append(1, 10))
        answer(400, """{"error":"exercise_list_full","maxItems":100}""")
        assertEquals(ConfigResult.Failure(ConfigError.ExerciseListFull(100)), repository.append(1, 10))
        lists.failure = { throw IOException("offline") }
        assertEquals(ConfigResult.Failure(ConfigError.Offline), repository.reorder(listOf(1)))
        synced()

        assertEquals(0, sessions.observeSources().first().size)
        assertEquals("no sources pull after a failure", 0, exercises.sourceCalls)
    }
}

private class FakeExerciseListService : ExerciseListService {
    val writes = mutableListOf<Pair<Int?, Any?>>()

    /** Throws to fail the next writes. */
    var failure: () -> Unit = {}

    private suspend fun write(id: Int?, body: Any?) {
        yield()
        failure()
        writes += id to body
    }

    private fun list(id: Int, name: String) = ExerciseList(id, "user", "user", name, null, 0, null, null, emptyList(), frozen = false)

    override suspend fun lists(): List<ExerciseList> = emptyList()

    override suspend fun create(body: ExerciseListRequest) = write(null, body).let { list(1, body.name) }

    override suspend fun update(id: Int, body: ExerciseListRequest) = write(id, body).let { list(id, body.name) }

    override suspend fun reorder(body: ExerciseListReorderRequest) = write(null, body).let { body.ids.map { list(it, "$it") } }

    override suspend fun delete(id: Int) = write(id, null)

    override suspend fun putItems(id: Int, body: ExerciseListItemsRequest) =
        write(id, body).let { ExerciseListItemsResponse(id, emptyList()) }

    override suspend fun append(id: Int, body: AppendListItemRequest) =
        write(id, body).let { ExerciseListItemsResponse(id, emptyList()) }
}
