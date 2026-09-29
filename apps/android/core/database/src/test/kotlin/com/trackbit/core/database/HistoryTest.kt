package com.trackbit.core.database

import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.HistoryEntity
import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.database.entity.OutboxOpType
import com.trackbit.core.model.DaysResponse
import com.trackbit.core.model.HabitDayValue
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant
import java.time.LocalDate

/** [com.trackbit.core.database.dao.SyncDao.applyDays] and [com.trackbit.core.database.dao.HistoryDao]. */
class HistoryTest : DatabaseTest() {
    private val logs = db.dayLogDao()
    private val history = db.historyDao()
    private val start: LocalDate = DAY.minusDays(30)
    private val at: Instant = Instant.parse("2026-09-26T10:00:00Z")

    private fun days(vararg days: HabitDayValue) = DaysResponse(start, DAY, days.toList())

    private suspend fun enqueue(habitId: Int, day: LocalDate) =
        db.outboxDao().enqueue(OutboxEntity(type = OutboxOpType.Increment, habitId = habitId, localDay = day, payload = "{}"))

    @Test fun `a pull makes the range match the server, and records itself on the request`() = runTest {
        insertHabits(habit(1), habit(2))
        history.upsert(HistoryEntity(start = start))
        logs.upsert(DayLogEntity(1, DAY.minusDays(20), rating = 9))
        logs.upsert(DayLogEntity(2, DAY.minusDays(10), rating = 9))
        logs.upsert(DayLogEntity(1, start.minusDays(1), rating = 9))

        db.syncDao().applyDays(
            days(
                HabitDayValue(1, DAY.minusDays(20), rating = 3, sessionCount = 0),
                HabitDayValue(2, DAY.minusDays(15), rating = null, sessionCount = 2),
                HabitDayValue(2, DAY.minusDays(14), rating = null, sessionCount = 0),
            ),
            syncedAt = at,
        )

        assertEquals(DayLogEntity(1, DAY.minusDays(20), rating = 3), logs.get(1, DAY.minusDays(20)))
        assertEquals(DayLogEntity(2, DAY.minusDays(15), rating = null, sessionCount = 2), logs.get(2, DAY.minusDays(15)))
        assertNull("an empty log is no log", logs.get(2, DAY.minusDays(14)))
        assertNull("gone from the server", logs.get(2, DAY.minusDays(10)))
        assertEquals("outside the range", 9, logs.get(1, start.minusDays(1))!!.rating)
        assertEquals(HistoryEntity(start = start, syncedStart = start, syncedAt = at), history.get())
    }

    @Test fun `days with pending ops keep their optimistic value`() = runTest {
        insertHabits(habit(1))
        logs.upsert(DayLogEntity(1, DAY.minusDays(20), rating = 4))
        logs.upsert(DayLogEntity(1, DAY.minusDays(21), rating = 4))
        enqueue(1, DAY.minusDays(20))
        enqueue(1, DAY.minusDays(21))

        db.syncDao().applyDays(days(HabitDayValue(1, DAY.minusDays(20), rating = 1, sessionCount = 0)), at)

        assertEquals(4, logs.get(1, DAY.minusDays(20))!!.rating)
        assertEquals(4, logs.get(1, DAY.minusDays(21))!!.rating)
    }

    @Test fun `skips habits Room doesn't have, and doesn't recreate a released request`() = runTest {
        insertHabits(habit(1))

        db.syncDao().applyDays(days(HabitDayValue(7, DAY.minusDays(20), rating = 1, sessionCount = 0)), at)

        assertNull(logs.get(7, DAY.minusDays(20)))
        assertNull(history.get())
    }

    @Test fun `releasing drops old logs, but not recent or pending ones`() = runTest {
        insertHabits(habit(1))
        history.upsert(HistoryEntity(start = start))
        val keepFrom = DAY.minusDays(6)
        logs.upsert(DayLogEntity(1, keepFrom, rating = 1))
        logs.upsert(DayLogEntity(1, keepFrom.minusDays(1), rating = 1))
        logs.upsert(DayLogEntity(1, keepFrom.minusDays(2), rating = 1))
        enqueue(1, keepFrom.minusDays(2))

        history.release(keepFrom)

        assertNull(history.get())
        assertEquals(1, logs.get(1, keepFrom)!!.rating)
        assertNull(logs.get(1, keepFrom.minusDays(1)))
        assertEquals("pending", 1, logs.get(1, keepFrom.minusDays(2))!!.rating)
    }

    @Test fun `a habit can be read over more days than the recent week`() = runTest {
        insertHabits(habit(1))
        logs.upsert(DayLogEntity(1, DAY.minusDays(20), rating = 2))

        val week = db.habitDayDao().observeHabitDay(1, DAY).first()!!
        val month = db.habitDayDao().observeHabitDay(1, DAY, days = 31).first()!!

        assertEquals(7, week.recent.size)
        assertEquals(31, month.recent.size)
        assertEquals(start, month.recent.first().day)
        assertEquals(DAY, month.current.day)
        assertEquals(2, month.recent.single { it.day == DAY.minusDays(20) }.rating)
    }
}
