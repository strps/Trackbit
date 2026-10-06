package com.trackbit.core.data

import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.GradientPresets
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitOrder
import com.trackbit.core.model.HabitReorderRequest
import com.trackbit.core.model.HabitRequest
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.LimitCounts
import com.trackbit.core.model.LimitsResponse
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.job
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException

/** The habits config is read from Room; writes go to the server and store its answer there. */
@RunWith(RobolectricTestRunner::class)
class HabitsRepositoryTest {
    private val db = inMemoryDatabase()
    private val tracker = FakeTrackerService()
    private val habits = FakeHabitsService { tracker.todayAnswer().habits.map { it.toConfigHabit() } }
    private val me = FakeMeService()
    private val clock = FakeClock()
    private val sync = trackerSync(db, tracker, clock = clock, habits = habits, me = me)
    private val scope = CoroutineScope(Job() + Dispatchers.Unconfined)
    private val repository = DefaultHabitsRepository(db, habits, sync, scope)

    /** Background syncs a write started must not outlive the database. */
    @After fun close() {
        runBlocking { synced() }
        db.close()
    }

    /** Waits for the background syncs the writes started. */
    private suspend fun synced() = scope.coroutineContext.job.children.forEach { it.join() }

    private val request = HabitRequest(
        "Read", HabitType.Count, false, 5, 2, ColorTheme.Custom, GradientPresets.getValue(ColorTheme.Blue), HabitIcon.Book,
        uuid = h(7),
    )

    @Test fun `habits are unknown until pulled, even with rows from today`() = runTest {
        db.syncDao().applyToday(todayResponse(DAY, todayHabit(1)))
        assertNull(repository.habits().first())

        habits.answer = { listOf(configHabit(1), configHabit(2, frozen = true)) }
        me.answer = { LimitsResponse(EffectiveLimits(4, null, null, listOf(HabitType.Count)), LimitCounts(2, 0, 0)) }
        assertEquals(SyncResult.Done, repository.refresh())

        assertEquals(listOf(configHabit(1), configHabit(2, frozen = true)), repository.habits().first())
        assertEquals(4, repository.limits().first()?.maxHabits)
    }

    @Test fun `a create stores the answer at once and today summarizes it`() = runTest {
        repository.refresh()
        tracker.todayAnswer = { todayResponse(DAY, todayHabit(7)) }

        val created = repository.create(request) as ConfigResult.Success
        assertEquals(listOf(h(7)), repository.habits().first()?.map { it.uuid })
        assertEquals(request.colorStops, repository.habits().first()!!.single().colorStops)
        synced()

        assertEquals("Read", created.value.name)
        assertEquals(listOf<Pair<String?, Any?>>(null to request), habits.writes)
        assertEquals(DAY, db.habitDao().get(h(7))?.summaryDay)
    }

    @Test fun `an update is sent without the uuid and keeps the habit's summary`() = runTest {
        db.syncDao().applyToday(todayResponse(DAY, todayHabit(7, streakBeforeDay = 3)))
        tracker.todayAnswer = { throw IOException("offline") }

        repository.update(h(7), request)
        synced()

        assertEquals(listOf<Pair<String?, Any?>>(h(7) to request.copy(uuid = null)), habits.writes)
        val row = db.habitDao().get(h(7))!!
        assertEquals("Read", row.name)
        assertEquals(3, row.streakBeforeDay)
        assertEquals(DAY, row.summaryDay)
    }

    @Test fun `a reorder stores each habit's group and place`() = runTest {
        db.syncDao().applyToday(todayResponse(DAY, todayHabit(1), todayHabit(2)))
        tracker.todayAnswer = { throw IOException("offline") }
        val order = listOf(HabitOrder(h(2), 0, isAntiHabit = false), HabitOrder(h(1), 0, isAntiHabit = true))

        assertEquals(ConfigResult.Success(Unit), repository.reorder(order))

        assertEquals(listOf<Pair<String?, Any?>>(null to HabitReorderRequest(order)), habits.writes)
        val rows = db.habitDao().observeAll().first()
        assertEquals(listOf(h(1) to true, h(2) to false), rows.map { it.uuid to it.isAntiHabit })
    }

    @Test fun `a delete drops the habit, also when the server had it gone already`() = runTest {
        db.syncDao().applyToday(todayResponse(DAY, todayHabit(1), todayHabit(2)))
        tracker.todayAnswer = { throw IOException("offline") }

        assertEquals(ConfigResult.Success(Unit), repository.delete(h(1)))
        habits.failure = { throw httpError(404) }
        assertEquals(ConfigResult.Success(Unit), repository.delete(h(2)))

        assertTrue(db.habitDao().observeAll().first().isEmpty())
    }

    @Test fun `refused writes map to the screen's errors and leave Room alone`() = runTest {
        db.syncDao().applyToday(todayResponse(DAY, todayHabit(7)))

        habits.failure = { throw httpError(403, """{"error":"habit_limit_reached","maxHabits":3}""") }
        assertEquals(ConfigResult.Failure(ConfigError.HabitLimitReached(3)), repository.create(request))
        habits.failure = { throw httpError(403, """{"error":"habit_frozen","habitId":7}""") }
        assertEquals(ConfigResult.Failure(ConfigError.HabitFrozen), repository.update(h(7), request))
        habits.failure = { throw IOException("offline") }
        assertEquals(ConfigResult.Failure(ConfigError.Offline), repository.delete(h(7)))
        synced()

        assertEquals(listOf("Habit 7"), db.habitDao().observeAll().first().map { it.name })
        assertEquals("no sync after a failure", emptyList<Any>(), tracker.todayDays)
    }
}
