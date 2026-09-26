package com.trackbit.core.database

import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.RecentDay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HabitDayDaoTest : DatabaseTest() {
    private val dao = db.habitDayDao()

    @Test fun `lists habits in display order with seven days ending at the day`() = runTest {
        insertHabits(habit(1, order = 1), habit(2, order = 0))
        db.dayLogDao().upsert(DayLogEntity(1, DAY, rating = 3))
        db.dayLogDao().upsert(DayLogEntity(1, DAY.minusDays(6), rating = 1, sessionCount = 2))
        db.dayLogDao().upsert(DayLogEntity(1, DAY.minusDays(7), rating = 9)) // outside the window
        db.dayLogDao().upsert(DayLogEntity(1, DAY.plusDays(1), rating = 9)) // after the day

        val days = dao.observeDay(DAY).first()

        assertEquals(listOf(2, 1), days.map { it.habit.id })
        val one = days[1]
        assertEquals((6 downTo 0).map { DAY.minusDays(it.toLong()) }, one.recent.map { it.day })
        assertEquals(RecentDay(DAY, 3, 0), one.current)
        assertEquals(RecentDay(DAY.minusDays(6), 1, 2), one.recent.first())
        assertEquals(listOf(null, null, null, null, null, null, null), days[0].recent.map { it.rating })
    }

    @Test fun `one habit, or null when it is gone`() = runTest {
        insertHabits(habit(1), habit(2))
        assertEquals(2, dao.observeHabitDay(2, DAY).first()!!.habit.id)
        assertNull(dao.observeHabitDay(3, DAY).first())
    }

    @Test fun `server enums survive a round trip, unknown ones included`() = runTest {
        insertHabits(habit(1).copy(type = HabitType.Unknown, colorTheme = ColorTheme.Unknown, icon = HabitIcon.Trees))
        val stored = db.habitDao().get(1)!!
        assertEquals(HabitType.Unknown, stored.type)
        assertEquals(ColorTheme.Unknown, stored.colorTheme)
        assertEquals(HabitIcon.Trees, stored.icon)
        assertEquals(habit(1).colorStops, stored.colorStops)
    }
}
