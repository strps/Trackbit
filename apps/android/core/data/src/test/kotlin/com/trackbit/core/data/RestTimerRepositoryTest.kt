package com.trackbit.core.data

import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** The rest countdown: adjusting, skipping, and what its end alarm finds. */
@RunWith(RobolectricTestRunner::class)
class RestTimerRepositoryTest {
    private val db = inMemoryDatabase()
    private val clock = FakeClock()
    private val repository = DefaultRestTimerRepository(db, clock)

    @After fun close() = db.close()

    private suspend fun start(seconds: Long) = db.timerDao().replaceRest(clock.now, clock.now.plusSeconds(seconds))

    private suspend fun current() = repository.observe().first()

    @Test fun `there is at most one, and starting one replaces it`() = runTest {
        start(90)
        clock.advanceMs(10_000)
        start(60)
        assertEquals(RestTimer(clock.now, clock.now.plusSeconds(60)), current())
        db.query("SELECT COUNT(*) FROM timers", null).use { cursor ->
            cursor.moveToFirst()
            assertEquals(1, cursor.getInt(0))
        }
    }

    @Test fun `remaining time and being over come from the end instant`() {
        val rest = RestTimer(clock.now, clock.now.plusSeconds(90))
        assertEquals(90_000, rest.totalMs)
        assertEquals(30_000, rest.remainingMs(clock.now.plusSeconds(60)))
        assertEquals(0, rest.remainingMs(clock.now.plusSeconds(100)))
        assertFalse(rest.isOver(clock.now.plusSeconds(89)))
        assertTrue(rest.isOver(clock.now.plusSeconds(90)))
    }

    @Test fun `adjust moves the end, and an end already past ends the rest`() = runTest {
        start(30)
        repository.adjust(15_000)
        assertEquals(clock.now.plusSeconds(45), current()?.endsAt)
        repository.adjust(-15_000)
        assertEquals(clock.now.plusSeconds(30), current()?.endsAt)

        clock.advanceMs(20_000)
        repository.adjust(-15_000)
        assertEquals(null, current())
        repository.adjust(15_000) // Nothing runs: no change.
        assertEquals(null, current())
    }

    @Test fun `skip ends it`() = runTest {
        start(30)
        repository.skip()
        assertEquals(null, current())
    }

    @Test fun `the alarm alerts only at a due end, and quietly drops a long-past one`() = runTest {
        assertEquals(RestEnd.None, repository.finishIfDue())

        start(30)
        clock.advanceMs(29_000)
        assertEquals(RestEnd.NotDue, repository.finishIfDue())
        assertEquals(clock.now.plusSeconds(1), current()?.endsAt)

        clock.advanceMs(1_000 + 60_000) // An inexact alarm, a minute late.
        assertEquals(RestEnd.Ended, repository.finishIfDue())
        assertEquals(null, current())

        start(30)
        clock.advanceMs(30_000 + 10 * 60_000) // The alarm was lost (a reboot).
        assertEquals(RestEnd.Stale, repository.finishIfDue())
        assertEquals(null, current())
    }

    @Test fun `habit timers are not the rest timer`() = runTest {
        start(30)
        assertEquals(emptyList<Any>(), db.timerDao().observeHabitTimers().first())
        repository.skip()
        assertEquals(null, db.timerDao().rest())
    }
}
