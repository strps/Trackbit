package com.trackbit.core.data

import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.model.DaysResponse
import com.trackbit.core.model.HabitDayValue
import kotlinx.coroutines.flow.first
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

/** Requesting, pulling and releasing history (beyond the recent week). */
@RunWith(RobolectricTestRunner::class)
class HistorySyncTest {
    private val db = inMemoryDatabase()
    private val service = FakeTrackerService()
    private val tokens = FakeTokens()
    private val scheduler = FakeScheduler()
    private val clock = FakeClock()
    private val sync = TrackerSync(db, service, tokens, clock)
    private val repository = DefaultTrackerRepository(db, sync, scheduler, clock)
    private val today: LocalDate = LocalDate.now()
    private val start: LocalDate = today.minusDays(60)
    private val old: LocalDate = today.minusDays(40)

    @Before fun seed() = runTest {
        db.syncDao().applyToday(todayResponse(today, todayHabit(1)))
        service.todayAnswer = { todayResponse(today, todayHabit(1)) }
        service.daysAnswer = { s, e -> DaysResponse(s, e, listOf(HabitDayValue(1, old, rating = 2, sessionCount = 0))) }
    }

    @After fun close() = db.close()

    private suspend fun rating(day: LocalDate) = db.dayLogDao().get(1, day)?.rating

    @Test fun `a request schedules a pull, which fills the range`() = runTest {
        repository.requestHistory(start)
        assertEquals(1, scheduler.historySyncs)

        assertEquals(SyncResult.Done, sync.syncHistory())

        assertEquals(listOf(start to today), service.daysRequests)
        assertEquals(2, rating(old))
    }

    @Test fun `a covered, fresh range isn't pulled again until it goes stale`() = runTest {
        repository.requestHistory(start)
        sync.syncHistory()

        repository.requestHistory(start.plusDays(1))
        sync.syncHistory()
        sync.sync()
        assertEquals("the next day's window is covered", 1, scheduler.historySyncs)
        assertEquals(1, service.daysRequests.size)

        clock.advanceMs(TrackerSync.HISTORY_MAX_AGE.toMillis())
        sync.sync()
        assertEquals("periodic sync refreshes stale history", listOf(start.plusDays(1) to today), service.daysRequests.drop(1))
    }

    @Test fun `an earlier start pulls again`() = runTest {
        repository.requestHistory(start)
        sync.syncHistory()

        repository.requestHistory(start.minusDays(7))

        assertEquals(2, scheduler.historySyncs)
        sync.syncHistory()
        assertEquals(start.minusDays(7) to today, service.daysRequests.last())
    }

    @Test fun `nothing is pulled without a request`() = runTest {
        assertEquals(SyncResult.Done, sync.syncHistory())
        sync.sync()
        assertEquals(emptyList<Any>(), service.daysRequests)
    }

    @Test fun `offline retries, and a pull that outlives the session writes nothing`() = runTest {
        repository.requestHistory(start)
        service.daysAnswer = { _, _ -> throw IOException("offline") }
        assertEquals(SyncResult.Retry, sync.syncHistory())

        service.daysAnswer = { s, e ->
            tokens.token = null
            DaysResponse(s, e, listOf(HabitDayValue(1, old, rating = 2, sessionCount = 0)))
        }
        assertEquals(SyncResult.SignedOut, sync.syncHistory())
        assertNull(rating(old))
    }

    @Test fun `releasing stops pulls and drops logs older than the week`() = runTest {
        repository.requestHistory(start)
        sync.syncHistory()

        repository.releaseHistory()

        assertNull(rating(old))
        clock.advanceMs(TrackerSync.HISTORY_MAX_AGE.toMillis())
        sync.sync()
        assertEquals(1, service.daysRequests.size)
    }

    @Test fun `a habit read over the window shows pulled days`() = runTest {
        repository.requestHistory(start)
        sync.syncHistory()

        val habit = repository.observeHabit(1, today, days = 61).first()!!

        assertEquals(61, habit.recent.size)
        assertEquals(2, habit.recent.single { it.day == old }.rating)
    }
}
