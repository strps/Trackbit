package com.trackbit.core.data

import com.trackbit.core.model.AppendListItemRequest
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.ExerciseListItem
import com.trackbit.core.model.ExerciseListItemsRequest
import com.trackbit.core.model.ExerciseListItemsResponse
import com.trackbit.core.model.ExerciseListReorderRequest
import com.trackbit.core.model.ExerciseListRequest
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.LimitCounts
import com.trackbit.core.model.LimitsResponse
import com.trackbit.core.model.ListItemDraft
import com.trackbit.core.model.Prescription
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.network.service.ExerciseListService
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
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException

/**
 * Lists are read from Room once pulled. Writes go to the server and store its answer in Room;
 * Room's sources and cached queues follow once they succeed.
 */
@RunWith(RobolectricTestRunner::class)
class ExerciseListsRepositoryTest {
    private val db = inMemoryDatabase()
    private val exercises = FakeExerciseService()
    private val lists = FakeExerciseListService()
    private val me = FakeMeService()
    private val clock = FakeClock()
    private val sync = trackerSync(db, exercises = exercises, clock = clock, lists = lists, me = me)
    private val scope = CoroutineScope(Job() + Dispatchers.Unconfined)
    private val repository = DefaultExerciseListsRepository(db, lists, sync, clock, scope)
    private val sessions = DefaultSessionRepository(db, sync, FakeScheduler(), clock, FakeAuth())

    /** Background syncs a write started must not outlive the database. */
    @After fun close() {
        runBlocking { synced() }
        db.close()
    }

    private suspend fun synced() = scope.coroutineContext.job.children.forEach { it.join() }

    private val prescribed = Prescription.NONE.copy(targetSets = 3, targetReps = 8)

    private fun legs(vararg items: ExerciseListItem) = exerciseList(lst(1), "Legs").copy(items = items.toList())

    private fun listItem(n: Int, exercise: Int, position: Int) =
        ExerciseListItem(item(n), ex(exercise), position, 3, 8, null, null, null, null, null)

    @Test fun `lists are unknown until pulled, then Room's, items in order`() = runTest {
        assertNull(repository.lists().first())
        lists.answer = { listOf(legs(listItem(2, 11, 1), listItem(1, 10, 0)), exerciseList(lst(2), "Arms", position = 1)) }
        me.answer = { LimitsResponse(EffectiveLimits(3, 5, 2, listOf(HabitType.Count)), LimitCounts(0, 0, 2)) }

        assertEquals(SyncResult.Done, repository.refresh())

        val pulled = repository.lists().first()!!
        assertEquals(listOf("Legs", "Arms"), pulled.map { it.name })
        assertEquals(listOf(item(1), item(2)), pulled[0].items.map { it.uuid })
        assertEquals(2, db.configDao().observeLimits().first()?.effective?.maxExerciseLists)
    }

    @Test fun `a failed pull leaves the lists unknown`() = runTest {
        lists.answer = { throw IOException("offline") }

        assertEquals(SyncResult.Retry, repository.refresh())
        assertNull(repository.lists().first())
    }

    @Test fun `writes store the server's answer in Room`() = runTest {
        repository.refresh()
        repository.create(ExerciseListRequest("Legs", null, uuid = lst(1)))
        assertEquals(listOf("Legs"), repository.lists().first()?.map { it.name })

        repository.update(lst(1), ExerciseListRequest("Leg day", null))
        assertEquals(listOf("Leg day"), repository.lists().first()?.map { it.name })

        repository.create(ExerciseListRequest("Arms", null, uuid = lst(2)))
        repository.reorder(listOf(lst(2), lst(1)))
        assertEquals(listOf(lst(2), lst(1)), repository.lists().first()?.map { it.uuid })

        repository.delete(lst(2))
        assertEquals(listOf(lst(1)), repository.lists().first()?.map { it.uuid })
    }

    @Test fun `an items write replaces the list's items with the answer`() = runTest {
        db.syncDao().applyLists(listOf(legs(listItem(1, 10, 0))), clock.instant())
        val answer = listOf(listItem(1, 10, 1), listItem(2, 11, 0))
        val service = object : ExerciseListService by lists {
            override suspend fun append(uuid: String, body: AppendListItemRequest) = ExerciseListItemsResponse(uuid, answer)
        }
        val repository = DefaultExerciseListsRepository(db, service, trackerSync(db, lists = service), clock, scope)

        repository.append(lst(1), ex(11))

        assertEquals(listOf(item(2), item(1)), repository.lists().first()!!.single().items.map { it.uuid })
    }

    @Test fun `a delete that finds the list gone counts as done`() = runTest {
        db.syncDao().applyLists(listOf(legs()), clock.instant())
        lists.failure = { throw httpError(404, """{"error":"Not found"}""") }

        assertEquals(ConfigResult.Success(Unit), repository.delete(lst(1)))
        assertEquals(emptyList<ExerciseList>(), repository.lists().first())
    }

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
        assertNull("nothing stored", repository.lists().first())
    }
}
