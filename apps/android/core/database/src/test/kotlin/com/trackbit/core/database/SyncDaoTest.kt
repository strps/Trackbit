package com.trackbit.core.database

import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.database.entity.OutboxOpType
import com.trackbit.core.model.DayLog
import com.trackbit.core.model.RecentDay
import com.trackbit.core.model.TodayHabit
import com.trackbit.core.model.TodayResponse
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant
import java.time.LocalDate

class SyncDaoTest : DatabaseTest() {
    private val logs = db.dayLogDao()

    private suspend fun sync(vararg habits: TodayHabit) =
        db.syncDao().applyToday(TodayResponse(DAY, habits.toList()))

    private suspend fun enqueue(habitUuid: String, day: LocalDate) =
        db.outboxDao().enqueue(OutboxEntity(type = OutboxOpType.Increment, habitUuid = habitUuid, localDay = day, payload = "{}"))

    @Test fun `replaces habits, dropping deleted ones with their logs`() = runTest {
        insertHabits(habit(H1), habit(H2))
        logs.upsert(DayLogEntity(H2, DAY, rating = 1))

        sync(habit(H1).copy(name = "Renamed").toTodayHabit())

        assertEquals("Renamed", db.habitDao().get(H1)!!.name)
        assertNull(db.habitDao().get(H2))
        assertNull(logs.get(H2, DAY))
    }

    @Test fun `server days overwrite local logs, and empty days clear them`() = runTest {
        insertHabits(habit(H1))
        logs.upsert(DayLogEntity(H1, DAY, rating = 5))
        logs.upsert(DayLogEntity(H1, DAY.minusDays(1), rating = 5))

        sync(
            habit(H1).toTodayHabit(
                recent = listOf(RecentDay(DAY.minusDays(1), rating = null, sessionCount = 0), RecentDay(DAY, rating = 2, sessionCount = 1)),
            ),
        )

        assertEquals(DayLogEntity(H1, DAY, rating = 2, sessionCount = 1), logs.get(H1, DAY))
        assertNull(logs.get(H1, DAY.minusDays(1)))
    }

    @Test fun `keeps day logs that still have pending ops`() = runTest {
        insertHabits(habit(H1))
        logs.addToRating(H1, DAY, 1)
        enqueue(H1, DAY)

        sync(habit(H1).toTodayHabit(recent = listOf(RecentDay(DAY, rating = null, sessionCount = 0))))

        assertEquals(1, logs.get(H1, DAY)!!.rating)
    }

    @Test fun `keeps a pending first log day the server doesn't know yet`() = runTest {
        insertHabits(habit(H1, isAntiHabit = true))
        db.habitDao().extendFirstLogDay(H1, DAY)
        enqueue(H1, DAY)

        sync(habit(H1, isAntiHabit = true, firstLogDay = null).toTodayHabit())
        assertEquals(DAY, db.habitDao().get(H1)!!.firstLogDay)

        db.outboxDao().delete(db.outboxDao().oldest()!!.id)
        sync(habit(H1, isAntiHabit = true, firstLogDay = DAY.minusDays(2)).toTodayHabit())
        assertEquals(DAY.minusDays(2), db.habitDao().get(H1)!!.firstLogDay)
    }

    @Test fun `outbox is first in, first out`() = runTest {
        insertHabits(habit(H1))
        val first = enqueue(H1, DAY)
        enqueue(H1, DAY.minusDays(1))
        val outbox = db.outboxDao()

        assertEquals(first, outbox.oldest()!!.id)
        outbox.recordFailure(first)
        assertEquals(1, outbox.oldest()!!.attempts)
        val keys = outbox.pendingDays()
        assertEquals(2, keys.size)
        outbox.delete(first)
        assertEquals(DAY.minusDays(1), outbox.oldest()!!.localDay)
    }

    private fun serverLog(habitUuid: String, day: LocalDate, rating: Int?) =
        DayLog(id = 99, habitUuid = habitUuid, rating = rating, notes = null, localDay = day, timeStamp = Instant.EPOCH, createdAt = Instant.EPOCH)

    @Test fun `a confirmed op stores the server's row and keeps the session count`() = runTest {
        insertHabits(habit(H1, isAntiHabit = true))
        logs.upsert(DayLogEntity(H1, DAY, rating = 1, sessionCount = 2))
        val op = enqueue(H1, DAY)

        db.syncDao().applyConfirmed(op, serverLog(H1, DAY, rating = 4))

        assertEquals(DayLogEntity(H1, DAY, rating = 4, sessionCount = 2), logs.get(H1, DAY))
        assertNull(db.outboxDao().oldest())
        assertEquals(DAY, db.habitDao().get(H1)!!.firstLogDay)
    }

    @Test fun `a confirmed op leaves the row alone while later ops for it are pending`() = runTest {
        insertHabits(habit(H1))
        logs.upsert(DayLogEntity(H1, DAY, rating = 2))
        val first = enqueue(H1, DAY)
        enqueue(H1, DAY)

        db.syncDao().applyConfirmed(first, serverLog(H1, DAY, rating = 1))

        assertEquals(2, logs.get(H1, DAY)!!.rating)
        assertEquals(1, db.outboxDao().pendingDays().size)
    }

    @Test fun `a confirmed op for a habit sync has deleted writes nothing`() = runTest {
        insertHabits(habit(H1))
        val op = enqueue(H1, DAY)
        sync()

        db.syncDao().applyConfirmed(op, serverLog(H1, DAY, rating = 1))

        assertNull(logs.get(H1, DAY))
        assertNull(db.outboxDao().oldest())
    }
}
