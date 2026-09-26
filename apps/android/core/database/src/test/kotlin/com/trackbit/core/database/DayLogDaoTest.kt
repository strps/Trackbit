package com.trackbit.core.database

import com.trackbit.core.database.entity.DayLogEntity
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class DayLogDaoTest : DatabaseTest() {
    private val dao = db.dayLogDao()

    @Test fun `addToRating starts from zero and accumulates`() = runTest {
        insertHabits(habit(1))
        assertEquals(1, dao.addToRating(1, DAY, 1).rating)
        assertEquals(3, dao.addToRating(1, DAY, 2).rating)
        assertEquals(2, dao.addToRating(1, DAY, -1).rating)
        assertEquals(2, dao.get(1, DAY)!!.rating)
    }

    @Test fun `setRating overwrites the rating and keeps sessions`() = runTest {
        insertHabits(habit(1))
        dao.upsert(DayLogEntity(1, DAY, rating = 5, sessionCount = 2))
        assertEquals(DayLogEntity(1, DAY, rating = 0, sessionCount = 2), dao.setRating(1, DAY, 0))
    }

    @Test fun `ensure creates an empty row and leaves an existing one alone`() = runTest {
        insertHabits(habit(1))
        assertEquals(DayLogEntity(1, DAY, rating = null), dao.ensure(1, DAY))
        dao.setRating(1, DAY, 4)
        assertEquals(4, dao.ensure(1, DAY).rating)
    }

    @Test fun `extendFirstLogDay only moves it earlier`() = runTest {
        insertHabits(habit(1, isAntiHabit = true))
        val habits = db.habitDao()
        habits.extendFirstLogDay(1, DAY)
        assertEquals(DAY, habits.get(1)!!.firstLogDay)
        habits.extendFirstLogDay(1, DAY.plusDays(1))
        assertEquals(DAY, habits.get(1)!!.firstLogDay)
        habits.extendFirstLogDay(1, DAY.minusDays(3))
        assertEquals(DAY.minusDays(3), habits.get(1)!!.firstLogDay)
    }
}
