package com.trackbit.core.data

import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.model.CheckRequest
import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.model.RecentDay
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException
import java.time.LocalDate

@RunWith(RobolectricTestRunner::class)
class TrackerSyncTest {
    private val db = inMemoryDatabase()
    private val service = FakeTrackerService()
    private val tokens = FakeTokens()
    private val scheduler = FakeScheduler()
    private val clock = FakeClock()
    private val sync = TrackerSync(db, service, FakeExerciseService(), tokens, clock)
    private val repository = DefaultTrackerRepository(db, sync, scheduler, clock)
    private val outbox = db.outboxDao()

    @Before fun seed() = runTest {
        db.syncDao().applyToday(todayResponse(DAY, todayHabit(1), todayHabit(2)))
    }

    @After fun close() = db.close()

    private suspend fun rating(habit: Int, day: LocalDate = DAY) = db.dayLogDao().get(h(habit), day)?.rating

    @Test fun `flush sends ops oldest first with their queued keys and stores the result`() = runTest {
        repository.increment(h(1), DAY, 1)
        repository.setRating(h(2), DAY, 5)
        val keys = listOf(outbox.oldest()!!.idempotencyKey)

        assertEquals(SyncResult.Done, sync.flush())

        assertEquals(listOf(IncrementRequest(h(1), 1, DAY), CheckRequest(h(2), 5, DAY)), service.sent.map { it.body })
        assertEquals(keys.first(), service.sent.first().key)
        assertNull(outbox.oldest())
        assertEquals(5, rating(2))
    }

    @Test fun `a network error keeps the op and its key for the retry`() = runTest {
        repository.increment(h(1), DAY, 1)
        val key = outbox.oldest()!!.idempotencyKey
        service.respond = { throw IOException("offline") }

        assertEquals(SyncResult.Retry, sync.flush())
        assertEquals(0, outbox.oldest()!!.attempts)

        service.respond = { dayLog(h(1), DAY, 1) }
        assertEquals(SyncResult.Done, sync.flush())
        assertEquals(listOf(key, key), service.sent.map { it.key })
    }

    @Test fun `nothing overtakes an op that is waiting to be retried`() = runTest {
        repository.increment(h(1), DAY, 1)
        repository.increment(h(2), DAY, 1)
        service.respond = { throw httpError(500, "{}") }

        assertEquals(SyncResult.Retry, sync.flush())

        assertEquals(1, service.sent.size)
        assertEquals(1, outbox.oldest()!!.attempts)
    }

    @Test fun `an op the server keeps failing is eventually dropped`() = runTest {
        repository.increment(h(1), DAY, 1)
        service.respond = { throw httpError(503, "{}") }

        repeat(TrackerSync.MAX_SERVER_ATTEMPTS - 1) { assertEquals(SyncResult.Retry, sync.flush()) }
        assertEquals(TrackerSync.MAX_SERVER_ATTEMPTS - 1, outbox.oldest()!!.attempts)

        sync.flush()
        assertNull(outbox.oldest())
    }

    @Test fun `a rejected op is dropped and the pull undoes it`() = runTest {
        repository.increment(h(1), DAY, 1)
        repository.increment(h(2), DAY, 1)
        service.respond = { body ->
            if ((body as IncrementRequest).habitUuid == h(1)) throw httpError(403, """{"error":"habit_frozen","habitId":1}""")
            dayLog(h(2), DAY, 1)
        }
        service.todayAnswer = { todayResponse(DAY, todayHabit(1, frozen = true, recent = listOf(RecentDay(DAY, null, 0))), todayHabit(2, recent = listOf(RecentDay(DAY, 1, 0)))) }

        assertEquals(SyncResult.Done, sync.flush())

        assertNull(outbox.oldest())
        assertNull(rating(1))
        assertEquals(1, rating(2))
        assertEquals(true, db.habitDao().get(h(1))!!.frozen)
    }

    @Test fun `a 401 stops the flush and keeps the op`() = runTest {
        repository.increment(h(1), DAY, 1)
        service.respond = { throw httpError(401, """{"code":"UNAUTHORIZED"}""") }

        assertEquals(SyncResult.SignedOut, sync.flush())
        assertEquals(IncrementRequest(h(1), 1, DAY), service.sent.single().body)
        assertEquals(0, outbox.oldest()!!.attempts)
    }

    @Test fun `sync pulls the device's day and keeps days with pending ops`() = runTest {
        repository.increment(h(1), DAY, 3)
        service.respond = { throw IOException("offline") }
        service.todayAnswer = {
            todayResponse(DAY, todayHabit(1, recent = listOf(RecentDay(DAY, null, 0))), todayHabit(2, recent = listOf(RecentDay(DAY, 4, 0))))
        }

        assertEquals(SyncResult.Retry, sync.sync())

        assertEquals(listOf<LocalDate?>(LocalDate.now()), service.todayDays)
        assertEquals(3, rating(1))
        assertEquals(4, rating(2))
    }

    @Test fun `a pull that fails with a client error is not retried`() = runTest {
        service.todayAnswer = { throw httpError(400, """{"message":"bad"}""") }
        assertEquals(SyncResult.Failed, sync.sync())
    }

    @Test fun `does nothing when signed out`() = runTest {
        repository.increment(h(1), DAY, 1)
        tokens.token = null

        assertEquals(SyncResult.SignedOut, sync.sync())
        assertEquals(0, service.sent.size)
    }

    @Test fun `a response that arrives after sign-out writes nothing`() = runTest {
        repository.increment(h(1), DAY, 1)
        service.respond = { body ->
            // Signed out while the request was in flight: Room is cleared before the response lands.
            tokens.token = null
            db.clearAllTables()
            dayLog((body as IncrementRequest).habitUuid, DAY, 1)
        }

        assertEquals(SyncResult.SignedOut, sync.flush())

        assertNull(db.habitDao().get(h(1)))
        assertNull(db.dayLogDao().get(h(1), DAY))
    }

    @Test fun `a snapshot fetched before a sign-in as someone else is not stored`() = runTest {
        service.todayAnswer = {
            tokens.token = "t2"
            todayResponse(DAY, todayHabit(9))
        }

        assertEquals(SyncResult.SignedOut, sync.sync())
        assertNull(db.habitDao().get(h(9)))
    }

    @Test fun `the confirmed row keeps its session count`() = runTest {
        db.dayLogDao().upsert(DayLogEntity(h(1), DAY, rating = null, sessionCount = 2))
        repository.setRating(h(1), DAY, 1)

        sync.flush()

        assertEquals(DayLogEntity(h(1), DAY, rating = 1, sessionCount = 2), db.dayLogDao().get(h(1), DAY))
    }
}
