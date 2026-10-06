package com.trackbit.core.data

import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.database.entity.ConfigPart
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.GradientPresets
import com.trackbit.core.model.Rgba
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException

/** The config's pulls into Room: when [TrackerSync.sync] makes them, and how they share the habits table. */
@RunWith(RobolectricTestRunner::class)
class ConfigSyncTest {
    private val db = inMemoryDatabase()
    private val clock = FakeClock()
    private val tracker = FakeTrackerService()
    private val pulls = mutableMapOf<ConfigPart, Int>()
    private fun pulled(part: ConfigPart) = pulls.merge(part, 1, Int::plus)

    private val exercises = FakeExerciseService { pulled(ConfigPart.Exercises); emptyList() }.apply {
        muscleGroupsAnswer = { pulled(ConfigPart.MuscleGroups); emptyList() }
    }
    private val habits = FakeHabitsService { pulled(ConfigPart.Habits); listOf(configHabit(1)) }
    private val lists = FakeExerciseListService { pulled(ConfigPart.Lists); emptyList() }
    private val me = FakeMeService().apply {
        val limits = answer
        answer = { pulled(ConfigPart.Limits); limits() }
    }
    private val sync = trackerSync(db, tracker, exercises, clock = clock, habits = habits, lists = lists, me = me)
    private val repository = DefaultTrackerRepository(db, sync, FakeScheduler(), clock)

    @After fun close() = db.close()

    @Test fun `sync pulls each part of the config when it is due, not while fresh`() = runTest {
        sync.sync()
        assertEquals(ConfigPart.entries.associateWith { 1 }, pulls)

        clock.advanceMs(TrackerSync.CONFIG_MAX_AGE.toMillis() - 1)
        sync.sync()
        assertEquals("fresh: not pulled again", ConfigPart.entries.associateWith { 1 }, pulls)

        sync.syncConfig(ConfigPart.Lists)
        clock.advanceMs(1)
        sync.sync()
        // The rest are due now; the lists were pulled a moment ago, so they aren't.
        assertEquals(ConfigPart.entries.associateWith { 2 }, pulls)
    }

    @Test fun `a part that failed stays due without stopping the others`() = runTest {
        habits.answer = { throw IOException("offline") }

        assertEquals(SyncResult.Retry, sync.sync())
        assertEquals(1, pulls[ConfigPart.Lists])
        assertNull(db.syncDao().configPulls()[ConfigPart.Habits])

        habits.answer = { listOf(configHabit(1)) }
        sync.sync()
        assertEquals(setOf(*ConfigPart.entries.toTypedArray()), db.syncDao().configPulls().keys)
    }

    @Test fun `the two habit pulls keep each other's columns`() = runTest {
        val own = listOf(ColorStop(0f, Rgba(9f, 9f, 9f, 1f)))
        tracker.todayAnswer = { todayResponse(DAY, todayHabit(1, streakBeforeDay = 4, firstLogDay = DAY.minusDays(9))) }
        habits.answer = { listOf(configHabit(1).copy(colorStops = own, name = "Renamed")) }

        sync.sync()
        val afterBoth = db.habitDao().get(h(1))!!
        assertEquals("Renamed", afterBoth.name)
        assertEquals(own, afterBoth.ownColorStops)
        assertEquals(GradientPresets.getValue(ColorTheme.Green), afterBoth.colorStops)
        assertEquals(4, afterBoth.streakBeforeDay)
        assertEquals(DAY, afterBoth.summaryDay)

        tracker.todayAnswer = { todayResponse(DAY, todayHabit(1, streakBeforeDay = 5)) }
        sync.sync()
        val afterToday = db.habitDao().get(h(1))!!
        assertEquals("a preset habit's own stops survive /today", own, afterToday.ownColorStops)
        assertEquals(5, afterToday.streakBeforeDay)
    }

    @Test fun `a custom habit's own stops come with today`() = runTest {
        tracker.todayAnswer = { todayResponse(DAY, todayHabit(1).copy(colorTheme = ColorTheme.Custom)) }
        habits.answer = { throw IOException("offline") }
        sync.sync()

        assertEquals(todayHabit(1).colorStops, db.habitDao().get(h(1))!!.ownColorStops)
    }

    @Test fun `a habit only the config pull brought has no streak, and its logs aren't known`() = runTest {
        habits.answer = { listOf(configHabit(1), configHabit(2)) }
        tracker.todayAnswer = { todayResponse(DAY, todayHabit(1)) }
        sync.sync()

        val known = repository.observeHabit(h(1), DAY).first()!!
        val unsummarized = repository.observeHabit(h(2), DAY).first()!!
        assertEquals(0, known.streak)
        assertTrue(known.allLogsKnown)
        assertNull(unsummarized.streak)
        assertNull(unsummarized.logsKnownFrom)
        assertFalse(unsummarized.allLogsKnown)

        tracker.todayAnswer = { todayResponse(DAY, todayHabit(1), todayHabit(2)) }
        sync.sync()
        assertEquals(0, repository.observeHabit(h(2), DAY).first()!!.streak)
    }

    @Test fun `a habit pull drops habits deleted on the server`() = runTest {
        tracker.todayAnswer = { todayResponse(DAY, todayHabit(1), todayHabit(2)) }
        habits.answer = { listOf(configHabit(1), configHabit(2)) }
        sync.sync()

        habits.answer = { listOf(configHabit(1)) }
        sync.syncConfig(ConfigPart.Habits)

        assertEquals(listOf(h(1)), db.habitDao().observeAll().first().map { it.uuid })
    }

    @Test fun `pulls answering after a sign-out store nothing`() = runTest {
        val tokens = FakeTokens()
        val signingOut = FakeHabitsService { tokens.token = null; listOf(configHabit(1)) }
        val sync = trackerSync(db, tokens = tokens, habits = signingOut)

        assertEquals(SyncResult.SignedOut, sync.syncConfig(ConfigPart.Habits))
        assertTrue(db.habitDao().observeAll().first().isEmpty())
        assertNull(db.syncDao().configPulls()[ConfigPart.Habits])
    }
}
