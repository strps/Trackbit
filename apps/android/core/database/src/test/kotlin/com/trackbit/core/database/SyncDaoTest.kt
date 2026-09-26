package com.trackbit.core.database

import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.database.entity.OutboxOpType
import com.trackbit.core.model.RecentDay
import com.trackbit.core.model.TodayHabit
import com.trackbit.core.model.TodayResponse
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate

class SyncDaoTest : DatabaseTest() {
    private val logs = db.dayLogDao()

    private suspend fun sync(vararg habits: TodayHabit) =
        db.syncDao().applyToday(TodayResponse(DAY, habits.toList()))

    private suspend fun enqueue(habitId: Int, day: LocalDate) =
        db.outboxDao().enqueue(OutboxEntity(type = OutboxOpType.Increment, habitId = habitId, localDay = day, payload = "{}"))

    @Test fun `replaces habits, dropping deleted ones with their logs`() = runTest {
        insertHabits(habit(1), habit(2))
        logs.upsert(DayLogEntity(2, DAY, rating = 1))

        sync(habit(1).copy(name = "Renamed").toTodayHabit())

        assertEquals("Renamed", db.habitDao().get(1)!!.name)
        assertNull(db.habitDao().get(2))
        assertNull(logs.get(2, DAY))
    }

    @Test fun `server days overwrite local logs, and empty days clear them`() = runTest {
        insertHabits(habit(1))
        logs.upsert(DayLogEntity(1, DAY, rating = 5))
        logs.upsert(DayLogEntity(1, DAY.minusDays(1), rating = 5))

        sync(
            habit(1).toTodayHabit(
                recent = listOf(RecentDay(DAY.minusDays(1), rating = null, sessionCount = 0), RecentDay(DAY, rating = 2, sessionCount = 1)),
            ),
        )

        assertEquals(DayLogEntity(1, DAY, rating = 2, sessionCount = 1), logs.get(1, DAY))
        assertNull(logs.get(1, DAY.minusDays(1)))
    }

    @Test fun `keeps day logs that still have pending ops`() = runTest {
        insertHabits(habit(1))
        logs.addToRating(1, DAY, 1)
        enqueue(1, DAY)

        sync(habit(1).toTodayHabit(recent = listOf(RecentDay(DAY, rating = null, sessionCount = 0))))

        assertEquals(1, logs.get(1, DAY)!!.rating)
    }

    @Test fun `keeps a pending first log day the server doesn't know yet`() = runTest {
        insertHabits(habit(1, isAntiHabit = true))
        db.habitDao().extendFirstLogDay(1, DAY)
        enqueue(1, DAY)

        sync(habit(1, isAntiHabit = true, firstLogDay = null).toTodayHabit())
        assertEquals(DAY, db.habitDao().get(1)!!.firstLogDay)

        db.outboxDao().delete(db.outboxDao().oldest()!!.id)
        sync(habit(1, isAntiHabit = true, firstLogDay = DAY.minusDays(2)).toTodayHabit())
        assertEquals(DAY.minusDays(2), db.habitDao().get(1)!!.firstLogDay)
    }

    @Test fun `outbox is first in, first out`() = runTest {
        insertHabits(habit(1))
        val first = enqueue(1, DAY)
        enqueue(1, DAY.minusDays(1))
        val outbox = db.outboxDao()

        assertEquals(first, outbox.oldest()!!.id)
        outbox.recordFailure(first)
        assertEquals(1, outbox.oldest()!!.attempts)
        val keys = outbox.pendingDays()
        assertEquals(2, keys.size)
        outbox.delete(first)
        assertEquals(DAY.minusDays(1), outbox.oldest()!!.localDay)
    }
}
