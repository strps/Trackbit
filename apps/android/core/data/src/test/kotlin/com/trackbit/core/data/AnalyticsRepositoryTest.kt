package com.trackbit.core.data

import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.model.HabitSet
import com.trackbit.core.model.HabitSetsResponse
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.MuscleGroupRef
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.io.IOException

/** The sets analytics reads: pulled per habit, replaced wholesale, kept offline. */
@RunWith(RobolectricTestRunner::class)
class AnalyticsRepositoryTest {
    private val db = inMemoryDatabase()
    private val service = FakeTrackerService()
    private val exercises = FakeExerciseService { listOf(exercise(10).copy(muscleGroups = listOf(MuscleGroupRef(1, "Chest")))) }
    private val tokens = FakeTokens()
    private val sync = TrackerSync(db, service, exercises, tokens, FakeClock())
    private val repository = DefaultAnalyticsRepository(db, sync)
    private val sessions = DefaultSessionRepository(db, sync, FakeScheduler(), FakeClock(), FakeAuth())

    private fun set(day: Int, weight: Double) = HabitSet(DAY.minusDays(day.toLong()), 10, weight, reps = 5, rpe = null, duration = null, distance = null)

    @Before fun seed() = runTest {
        db.syncDao().applyToday(todayResponse(DAY, todayHabit(1, type = HabitType.Complex), todayHabit(2, type = HabitType.Complex)))
    }

    @After fun close() = db.close()

    @Test fun `sets are unknown until pulled, then replaced by each pull`() = runTest {
        assertNull(repository.observeSets(1).first())

        service.setsAnswer = { HabitSetsResponse(it, listOf(set(2, 40.0), set(1, 42.5))) }
        assertEquals(SyncResult.Done, repository.refresh(1))
        assertEquals(listOf(set(2, 40.0), set(1, 42.5)), repository.observeSets(1).first())
        assertNull("another habit's sets are still unknown", repository.observeSets(2).first())
        assertEquals(listOf(MuscleGroupRef(1, "Chest")), sessions.observeExercises().first().single().muscleGroups)

        service.setsAnswer = { HabitSetsResponse(it, emptyList()) }
        repository.refresh(1)
        assertEquals(emptyList<HabitSet>(), repository.observeSets(1).first())
    }

    @Test fun `offline keeps the last pull`() = runTest {
        service.setsAnswer = { HabitSetsResponse(it, listOf(set(1, 40.0))) }
        repository.refresh(1)

        service.setsAnswer = { throw IOException("offline") }
        assertEquals(SyncResult.Retry, repository.refresh(1))
        assertEquals(listOf(set(1, 40.0)), repository.observeSets(1).first())
    }

    @Test fun `a pull that outlives the session writes nothing`() = runTest {
        service.setsAnswer = {
            tokens.token = null
            HabitSetsResponse(it, listOf(set(1, 40.0)))
        }

        assertEquals(SyncResult.SignedOut, repository.refresh(1))
        assertNull(repository.observeSets(1).first())
    }
}
