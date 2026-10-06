package com.trackbit.widget.heatmap

import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import com.trackbit.core.model.RecentDay
import com.trackbit.widget.FakeTrackerRepository
import com.trackbit.widget.habit
import com.trackbit.widget.habitUuid
import com.trackbit.core.model.HistoryOwner
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.DayOfWeek
import java.time.LocalDate

class HeatmapWindowTest {
    // A Wednesday.
    private val today = LocalDate.of(2026, 9, 30)
    private val window = HeatmapWindow(today, DayOfWeek.MONDAY)

    @Test fun `the window is whole weeks ending with today's`() {
        assertEquals(LocalDate.of(2026, 9, 28).minusWeeks(25), window.start)
        assertEquals(DayOfWeek.MONDAY, window.start.dayOfWeek)
        assertEquals(25 * 7 + 3, window.days)
        assertEquals("Sunday-first weeks", DayOfWeek.SUNDAY, HeatmapWindow(today, DayOfWeek.SUNDAY).start.dayOfWeek)
    }

    @Test fun `weeks run from the week start, fill gaps and stop at today`() {
        val logged = RecentDay(LocalDate.of(2026, 9, 22), rating = 3, sessionCount = 0)

        val weeks = window.weeks(listOf(logged), count = 2)

        assertEquals(2, weeks.size)
        assertEquals(LocalDate.of(2026, 9, 21), weeks[0][0]!!.day)
        assertEquals(logged, weeks[0][1])
        assertEquals(RecentDay(LocalDate.of(2026, 9, 23), rating = null, sessionCount = 0), weeks[0][2])
        assertEquals(today, weeks[1][2]!!.day)
        assertNull("after today", weeks[1][3])
        assertEquals(7, weeks[1].size)
    }

    @Test fun `never more weeks than the window holds`() {
        assertEquals(HeatmapWindow.MAX_WEEKS, window.weeks(emptyList(), count = 100).size)
        assertEquals(window.start, window.weeks(emptyList(), count = 100).first().first()!!.day)
    }

    @Test fun `cells take the height, weeks the width`() {
        // Short: 7 rows of 8 dp fit the height (less padding and header), and the width fits 26 weeks and more.
        val small = gridFor(DpSize(300.dp, 108.dp))
        assertEquals(8.dp, small.pitch)
        assertEquals(HeatmapWindow.MAX_WEEKS, small.weeks)

        // Taller: bigger cells, so fewer weeks.
        val tall = gridFor(DpSize(300.dp, 178.dp))
        assertEquals(18.dp, tall.pitch)
        assertEquals(15, tall.weeks)
    }

    @Test fun `observing asks for the window's history first`() = runTest {
        val tracker = FakeTrackerRepository()
        tracker.days.value = mapOf(today to listOf(habit(1, day = today)))

        val habit = observeWithHistory(tracker, habitUuid(1), window).first()

        assertEquals(habitUuid(1), habit!!.uuid)
        assertEquals(listOf(HistoryOwner.Heatmap to window.start), tracker.historyRequests)
        assertEquals(listOf(Triple(habitUuid(1), today, window.days)), tracker.observed)
    }
}
