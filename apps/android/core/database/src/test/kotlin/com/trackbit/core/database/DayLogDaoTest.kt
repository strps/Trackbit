package com.trackbit.core.database

import com.trackbit.core.database.entity.DayLogEntity
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class DayLogDaoTest : DatabaseTest() {
    private val dao = db.dayLogDao()

    @Test fun `addToRating starts from zero and accumulates`() = runTest {
        insertHabits(habit(H1))
        assertEquals(1, dao.addToRating(H1, DAY, 1).rating)
        assertEquals(3, dao.addToRating(H1, DAY, 2).rating)
        assertEquals(2, dao.addToRating(H1, DAY, -1).rating)
        assertEquals(2, dao.get(H1, DAY)!!.rating)
    }

    @Test fun `setRating overwrites the rating and keeps sessions`() = runTest {
        insertHabits(habit(H1))
        dao.upsert(DayLogEntity(H1, DAY, rating = 5, sessionCount = 2))
        assertEquals(DayLogEntity(H1, DAY, rating = 0, sessionCount = 2), dao.setRating(H1, DAY, 0))
    }

    @Test fun `ensure creates an empty row and leaves an existing one alone`() = runTest {
        insertHabits(habit(H1))
        assertEquals(DayLogEntity(H1, DAY, rating = null), dao.ensure(H1, DAY))
        dao.setRating(H1, DAY, 4)
        assertEquals(4, dao.ensure(H1, DAY).rating)
    }

    @Test fun `extendFirstLogDay only moves it earlier`() = runTest {
        insertHabits(habit(H1, isAntiHabit = true))
        val habits = db.habitDao()
        habits.extendFirstLogDay(H1, DAY)
        assertEquals(DAY, habits.get(H1)!!.firstLogDay)
        habits.extendFirstLogDay(H1, DAY.plusDays(1))
        assertEquals(DAY, habits.get(H1)!!.firstLogDay)
        habits.extendFirstLogDay(H1, DAY.minusDays(3))
        assertEquals(DAY.minusDays(3), habits.get(H1)!!.firstLogDay)
    }
}
