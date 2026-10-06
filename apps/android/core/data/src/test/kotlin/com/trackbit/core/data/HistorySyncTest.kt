package com.trackbit.core.data

import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.model.DaysResponse
import com.trackbit.core.model.HabitDayValue
import com.trackbit.core.model.HistoryOwner
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
    private val sync = trackerSync(db, service, tokens = tokens, clock = clock)
    private val repository = DefaultTrackerRepository(db, sync, scheduler, clock)
    private val today: LocalDate = LocalDate.now()
    private val start: LocalDate = today.minusDays(60)
    private val old: LocalDate = today.minusDays(40)

    @Before fun seed() = runTest {
        db.syncDao().applyToday(todayResponse(today, todayHabit(1)))
        service.todayAnswer = { todayResponse(today, todayHabit(1)) }
        service.daysAnswer = { s, e -> DaysResponse(s, e, listOf(HabitDayValue(h(1), old, rating = 2, sessionCount = 0))) }
    }

    @After fun close() = db.close()

    private suspend fun rating(day: LocalDate) = db.dayLogDao().get(h(1), day)?.rating

    @Test fun `a request schedules a pull, which fills the range`() = runTest {
        repository.requestHistory(HistoryOwner.Heatmap, start)
        assertEquals(1, scheduler.historySyncs)

        assertEquals(SyncResult.Done, sync.syncHistory())

        assertEquals(listOf(start to today), service.daysRequests)
        assertEquals(2, rating(old))
    }

    @Test fun `a covered, fresh range isn't pulled again until it goes stale`() = runTest {
        repository.requestHistory(HistoryOwner.Heatmap, start)
        sync.syncHistory()

        repository.requestHistory(HistoryOwner.Heatmap, start.plusDays(1))
        sync.syncHistory()
        sync.sync()
        assertEquals("the next day's window is covered", 1, scheduler.historySyncs)
        assertEquals(1, service.daysRequests.size)

        clock.advanceMs(TrackerSync.HISTORY_MAX_AGE.toMillis())
        sync.sync()
        assertEquals("periodic sync refreshes stale history", listOf(start.plusDays(1) to today), service.daysRequests.drop(1))
    }

    @Test fun `an earlier start pulls again`() = runTest {
        repository.requestHistory(HistoryOwner.Heatmap, start)
        sync.syncHistory()

        repository.requestHistory(HistoryOwner.Heatmap, start.minusDays(7))

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
        repository.requestHistory(HistoryOwner.Heatmap, start)
        service.daysAnswer = { _, _ -> throw IOException("offline") }
        assertEquals(SyncResult.Retry, sync.syncHistory())

        service.daysAnswer = { s, e ->
            tokens.token = null
            DaysResponse(s, e, listOf(HabitDayValue(h(1), old, rating = 2, sessionCount = 0)))
        }
        assertEquals(SyncResult.SignedOut, sync.syncHistory())
        assertNull(rating(old))
    }

    @Test fun `releasing stops pulls and drops logs older than the week`() = runTest {
        repository.requestHistory(HistoryOwner.Heatmap, start)
        sync.syncHistory()

        repository.releaseHistory(HistoryOwner.Heatmap)

        assertNull(rating(old))
        clock.advanceMs(TrackerSync.HISTORY_MAX_AGE.toMillis())
        sync.sync()
        assertEquals(1, service.daysRequests.size)
    }

    @Test fun `a habit read over the window shows pulled days`() = runTest {
        repository.requestHistory(HistoryOwner.Heatmap, start)
        sync.syncHistory()

        val habit = repository.observeHabit(h(1), today, days = 61).first()!!

        assertEquals(61, habit.recent.size)
        assertEquals(2, habit.recent.single { it.day == old }.rating)
    }

    @Test fun `a request longer than one pull allows comes in chunks, newest first`() = runTest {
        val far = today.minusDays(500)
        repository.requestHistory(HistoryOwner.Tracker, far)

        assertEquals(SyncResult.Done, sync.syncHistory())

        val chunk = TrackerSync.MAX_DAYS_PER_PULL - 1L
        assertEquals(
            listOf(today.minusDays(chunk) to today, far to today.minusDays(chunk + 1)),
            service.daysRequests,
        )
        sync.syncHistory()
        assertEquals("covered", 2, service.daysRequests.size)
    }

    @Test fun `a failed chunk leaves the request due`() = runTest {
        repository.requestHistory(HistoryOwner.Tracker, today.minusDays(500))
        var calls = 0
        service.daysAnswer = { s, e ->
            if (++calls == 2) throw IOException("offline")
            DaysResponse(s, e, emptyList())
        }

        assertEquals(SyncResult.Retry, sync.syncHistory())
        sync.syncHistory()

        assertEquals(today.minusDays(500), service.daysRequests.last().first)
        assertEquals(4, service.daysRequests.size)
    }

    @Test fun `owners keep their own requests, and only the earliest due one is pulled`() = runTest {
        repository.requestHistory(HistoryOwner.Heatmap, start)
        sync.syncHistory()
        repository.requestHistory(HistoryOwner.Tracker, today.minusDays(30))
        assertEquals("the tracker's range is covered by the heatmap's pull", 1, scheduler.historySyncs)

        repository.requestHistory(HistoryOwner.Tracker, start.minusDays(10))
        sync.syncHistory()
        assertEquals(start.minusDays(10) to today, service.daysRequests.last())

        repository.releaseHistory(HistoryOwner.Tracker)
        assertEquals("the heatmap still needs it", 2, rating(old))

        // The heatmap's request was pulled from further back with the tracker's; after the release
        // it may only claim its own range, so asking for more pulls again.
        repository.requestHistory(HistoryOwner.Tracker, start.minusDays(5))
        assertEquals(3, scheduler.historySyncs)
    }

    @Test fun `a past day's streak comes from pulled history`() = runTest {
        val day = today.minusDays(30)
        db.syncDao().applyToday(todayResponse(today, todayHabit(1, firstLogDay = day.minusDays(4))))
        service.daysAnswer = { s, e ->
            DaysResponse(s, e, (0L..4L).map { HabitDayValue(h(1), day.minusDays(it), rating = 1, sessionCount = 0) })
        }

        val before = repository.observeDay(day, STREAK_DAYS).first().single()
        assertNull("not known before the pull", before.streak)

        repository.requestHistory(HistoryOwner.Tracker, day.minusDays(STREAK_DAYS - 1L))
        sync.syncHistory()

        assertEquals(5, repository.observeDay(day, STREAK_DAYS).first().single().streak)
    }
}
