package com.trackbit.core.database

import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.TimerEntity
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.RecentDay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant

class HabitDayDaoTest : DatabaseTest() {
    private val dao = db.habitDayDao()

    @Test fun `lists habits in display order with seven days ending at the day`() = runTest {
        insertHabits(habit(H1, order = 1), habit(H2, order = 0))
        db.dayLogDao().upsert(DayLogEntity(H1, DAY, rating = 3))
        db.dayLogDao().upsert(DayLogEntity(H1, DAY.minusDays(6), rating = 1, sessionCount = 2))
        db.dayLogDao().upsert(DayLogEntity(H1, DAY.minusDays(7), rating = 9)) // outside the window
        db.dayLogDao().upsert(DayLogEntity(H1, DAY.plusDays(1), rating = 9)) // after the day

        val days = dao.observeDay(DAY).first()

        assertEquals(listOf(H2, H1), days.map { it.habit.uuid })
        val one = days[1]
        assertEquals((6 downTo 0).map { DAY.minusDays(it.toLong()) }, one.recent.map { it.day })
        assertEquals(RecentDay(DAY, 3, 0), one.current)
        assertEquals(RecentDay(DAY.minusDays(6), 1, 2), one.recent.first())
        assertEquals(listOf(null, null, null, null, null, null, null), days[0].recent.map { it.rating })
    }

    @Test fun `a running timer joins its habit once, whatever the number of logs`() = runTest {
        insertHabits(habit(H1), habit(H2, order = 1))
        db.dayLogDao().upsert(DayLogEntity(H1, DAY, rating = 3))
        db.dayLogDao().upsert(DayLogEntity(H1, DAY.minusDays(1), rating = 2))
        val timer = TimerEntity(habitUuid = H1, localDay = DAY.minusDays(1), startedAt = Instant.ofEpochMilli(1_000))
        db.timerDao().start(timer)

        val days = dao.observeDay(DAY).first()

        assertEquals(listOf(H1, H2), days.map { it.habit.uuid })
        assertEquals(timer.copy(id = 1), days[0].timer)
        assertEquals(listOf(2, 3), days[0].recent.mapNotNull { it.rating })
        assertNull(days[1].timer)
    }

    @Test fun `one habit, or null when it is gone`() = runTest {
        insertHabits(habit(H1), habit(H2))
        assertEquals(H2, dao.observeHabitDay(H2, DAY).first()!!.habit.uuid)
        assertNull(dao.observeHabitDay(H3, DAY).first())
    }

    @Test fun `server enums survive a round trip, unknown ones included`() = runTest {
        insertHabits(habit(H1).copy(type = HabitType.Unknown, colorTheme = ColorTheme.Unknown, icon = HabitIcon.Trees))
        val stored = db.habitDao().get(H1)!!
        assertEquals(HabitType.Unknown, stored.type)
        assertEquals(ColorTheme.Unknown, stored.colorTheme)
        assertEquals(HabitIcon.Trees, stored.icon)
        assertEquals(habit(H1).colorStops, stored.colorStops)
    }
}
