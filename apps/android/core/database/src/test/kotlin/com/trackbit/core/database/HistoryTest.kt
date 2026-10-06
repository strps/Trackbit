package com.trackbit.core.database

import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.HistoryEntity
import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.database.entity.OutboxOpType
import com.trackbit.core.model.DaysResponse
import com.trackbit.core.model.HabitDayValue
import com.trackbit.core.model.HistoryOwner
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

    private suspend fun enqueue(habitUuid: String, day: LocalDate) =
        db.outboxDao().enqueue(OutboxEntity(type = OutboxOpType.Increment, habitUuid = habitUuid, localDay = day, payload = "{}"))

    @Test fun `a pull makes the range match the server, and records itself on the request`() = runTest {
        insertHabits(habit(H1), habit(H2))
        history.upsert(HistoryEntity(HistoryOwner.Heatmap, start))
        logs.upsert(DayLogEntity(H1, DAY.minusDays(20), rating = 9))
        logs.upsert(DayLogEntity(H2, DAY.minusDays(10), rating = 9))
        logs.upsert(DayLogEntity(H1, start.minusDays(1), rating = 9))

        db.syncDao().applyDays(
            days(
                HabitDayValue(H1, DAY.minusDays(20), rating = 3, sessionCount = 0),
                HabitDayValue(H2, DAY.minusDays(15), rating = null, sessionCount = 2),
                HabitDayValue(H2, DAY.minusDays(14), rating = null, sessionCount = 0),
            ),
            syncedAt = at,
        )

        assertEquals(DayLogEntity(H1, DAY.minusDays(20), rating = 3), logs.get(H1, DAY.minusDays(20)))
        assertEquals(DayLogEntity(H2, DAY.minusDays(15), rating = null, sessionCount = 2), logs.get(H2, DAY.minusDays(15)))
        assertNull("an empty log is no log", logs.get(H2, DAY.minusDays(14)))
        assertNull("gone from the server", logs.get(H2, DAY.minusDays(10)))
        assertEquals("outside the range", 9, logs.get(H1, start.minusDays(1))!!.rating)
        assertEquals(HistoryEntity(HistoryOwner.Heatmap, start, syncedStart = start, syncedAt = at), history.get(HistoryOwner.Heatmap))
    }

    @Test fun `days with pending ops keep their optimistic value`() = runTest {
        insertHabits(habit(H1))
        logs.upsert(DayLogEntity(H1, DAY.minusDays(20), rating = 4))
        logs.upsert(DayLogEntity(H1, DAY.minusDays(21), rating = 4))
        enqueue(H1, DAY.minusDays(20))
        enqueue(H1, DAY.minusDays(21))

        db.syncDao().applyDays(days(HabitDayValue(H1, DAY.minusDays(20), rating = 1, sessionCount = 0)), at)

        assertEquals(4, logs.get(H1, DAY.minusDays(20))!!.rating)
        assertEquals(4, logs.get(H1, DAY.minusDays(21))!!.rating)
    }

    @Test fun `skips habits Room doesn't have, and doesn't recreate a released request`() = runTest {
        insertHabits(habit(H1))

        db.syncDao().applyDays(days(HabitDayValue(H7, DAY.minusDays(20), rating = 1, sessionCount = 0)), at)

        assertNull(logs.get(H7, DAY.minusDays(20)))
        assertEquals(emptyList<HistoryEntity>(), history.all())
    }

    @Test fun `releasing drops old logs, but not recent or pending ones`() = runTest {
        insertHabits(habit(H1))
        history.upsert(HistoryEntity(HistoryOwner.Heatmap, start))
        val keepFrom = DAY.minusDays(6)
        logs.upsert(DayLogEntity(H1, keepFrom, rating = 1))
        logs.upsert(DayLogEntity(H1, keepFrom.minusDays(1), rating = 1))
        logs.upsert(DayLogEntity(H1, keepFrom.minusDays(2), rating = 1))
        enqueue(H1, keepFrom.minusDays(2))

        history.release(HistoryOwner.Heatmap, recentFrom = keepFrom)

        assertNull(history.get(HistoryOwner.Heatmap))
        assertEquals(1, logs.get(H1, keepFrom)!!.rating)
        assertNull(logs.get(H1, keepFrom.minusDays(1)))
        assertEquals("pending", 1, logs.get(H1, keepFrom.minusDays(2))!!.rating)
    }

    @Test fun `a habit can be read over more days than the recent week`() = runTest {
        insertHabits(habit(H1))
        logs.upsert(DayLogEntity(H1, DAY.minusDays(20), rating = 2))

        val week = db.habitDayDao().observeHabitDay(H1, DAY).first()!!
        val month = db.habitDayDao().observeHabitDay(H1, DAY, days = 31).first()!!

        assertEquals(7, week.recent.size)
        assertEquals(31, month.recent.size)
        assertEquals(start, month.recent.first().day)
        assertEquals(DAY, month.current.day)
        assertEquals(2, month.recent.single { it.day == DAY.minusDays(20) }.rating)
    }

    @Test fun `a pull is recorded only on the requests it covers`() = runTest {
        history.upsert(HistoryEntity(HistoryOwner.Heatmap, start))
        history.upsert(HistoryEntity(HistoryOwner.Tracker, start.minusDays(10)))

        db.syncDao().applyDays(days(), at)

        assertEquals(start, history.get(HistoryOwner.Heatmap)!!.syncedStart)
        assertNull(history.get(HistoryOwner.Tracker)!!.syncedStart)
    }

    @Test fun `releasing one owner keeps what another still asks for`() = runTest {
        insertHabits(habit(H1))
        val trackerStart = start.minusDays(10)
        history.upsert(HistoryEntity(HistoryOwner.Heatmap, start, syncedStart = trackerStart, syncedAt = at))
        history.upsert(HistoryEntity(HistoryOwner.Tracker, trackerStart, syncedStart = trackerStart, syncedAt = at))
        logs.upsert(DayLogEntity(H1, start, rating = 1))
        logs.upsert(DayLogEntity(H1, start.minusDays(1), rating = 1))

        history.release(HistoryOwner.Tracker, recentFrom = DAY.minusDays(6))

        assertEquals(1, logs.get(H1, start)!!.rating)
        assertNull(logs.get(H1, start.minusDays(1)))
        assertEquals("no longer covers the dropped days", start, history.get(HistoryOwner.Heatmap)!!.syncedStart)
    }
}
