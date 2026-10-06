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
        db.syncDao().applyQueue("list:1", queue("list:1", QueueEntry(ex(10), 0, item(5), null)), clock.instant())
        exercises.sourcesAnswer = { listOf(source("list:1", name = "Legs")) }
        exercises.queueAnswer = { key -> queue(key, QueueEntry(ex(10), 0, item(5), prescribed)) }

        val items = listOf(ListItemDraft(item(5), ex(10), prescribed), ListItemDraft(item(6), ex(11), Prescription.NONE))
        repository.saveItems(lst(1), items)
        synced()

        assertEquals(listOf(lst(1) to ExerciseListItemsRequest.of(items)), lists.writes)
        assertEquals(listOf("Legs"), sessions.observeSources().first().map { it.name })
        val queue = sessions.observeQueue("list:1").first() as SourceQueue.Resolved
        assertEquals(prescribed, queue.entries.single().prescription)
        assertNull("a queue Room never held isn't pulled", sessions.observeQueue("list:2").first())
    }

    @Test fun `each write is sent as such`() = runTest {
        val request = ExerciseListRequest("Legs", null)
        val create = request.copy(uuid = lst(3))
        repository.create(create)
        repository.update(lst(2), request)
        repository.reorder(listOf(lst(2), lst(1)))
        repository.append(lst(2), ex(11))
        repository.delete(lst(1))
        synced()

        val append = lists.writes[3].second as AppendListItemRequest
        assertEquals(
            listOf(
                null to create, lst(2) to request, null to ExerciseListReorderRequest(listOf(lst(2), lst(1))),
                lst(2) to AppendListItemRequest(append.uuid, ex(11)), lst(1) to null,
            ),
            lists.writes,
        )
    }

    @Test fun `refused writes map to the screen's errors and leave Room alone`() = runTest {
        fun answer(status: Int, body: String) {
            lists.failure = { throw httpError(status, body) }
        }
        val request = ExerciseListRequest("Legs", null, uuid = lst(3))

        answer(403, """{"error":"exercise_list_limit_reached","maxExerciseLists":3}""")
        assertEquals(ConfigResult.Failure(ConfigError.ExerciseListLimitReached(3)), repository.create(request))
        answer(409, """{"error":"exercise_list_name_taken"}""")
        assertEquals(ConfigResult.Failure(ConfigError.ExerciseListNameTaken), repository.update(lst(1), request.copy(uuid = null)))
        answer(403, """{"error":"exercise_list_frozen","listId":1}""")
        assertEquals(ConfigResult.Failure(ConfigError.ExerciseListFrozen), repository.append(lst(1), ex(10)))
        answer(400, """{"error":"exercise_list_full","maxItems":100}""")
        assertEquals(ConfigResult.Failure(ConfigError.ExerciseListFull(100)), repository.append(lst(1), ex(10)))
        lists.failure = { throw IOException("offline") }
        assertEquals(ConfigResult.Failure(ConfigError.Offline), repository.reorder(listOf(lst(1))))
        synced()

        assertEquals(0, sessions.observeSources().first().size)
        assertEquals("no sources pull after a failure", 0, exercises.sourceCalls)
    }
}

private class FakeExerciseListService : ExerciseListService {
    val writes = mutableListOf<Pair<String?, Any?>>()

    /** Throws to fail the next writes. */
    var failure: () -> Unit = {}

    private suspend fun write(uuid: String?, body: Any?) {
        yield()
        failure()
        writes += uuid to body
    }

    private fun list(uuid: String, name: String) = ExerciseList(uuid, "user", "user", name, null, 0, null, null, emptyList(), frozen = false)

    override suspend fun lists(): List<ExerciseList> = emptyList()

    override suspend fun create(body: ExerciseListRequest) = write(null, body).let { list(body.uuid!!, body.name) }

    override suspend fun update(uuid: String, body: ExerciseListRequest) = write(uuid, body).let { list(uuid, body.name) }

    override suspend fun reorder(body: ExerciseListReorderRequest) = write(null, body).let { body.uuids.map { list(it, it) } }

    override suspend fun delete(uuid: String) = write(uuid, null)

    override suspend fun putItems(uuid: String, body: ExerciseListItemsRequest) =
        write(uuid, body).let { ExerciseListItemsResponse(uuid, emptyList()) }

    override suspend fun append(uuid: String, body: AppendListItemRequest) =
        write(uuid, body).let { ExerciseListItemsResponse(uuid, emptyList()) }
}
