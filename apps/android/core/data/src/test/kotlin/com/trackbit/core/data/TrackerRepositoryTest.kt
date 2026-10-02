package com.trackbit.core.data

import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.database.entity.OutboxOpType
import com.trackbit.core.model.CheckRequest
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.model.ProgressState
import com.trackbit.core.model.RecentDay
import com.trackbit.core.model.serialization.TrackbitJson
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class TrackerRepositoryTest {
    private val db = inMemoryDatabase()
    private val scheduler = FakeScheduler()
    private val clock = FakeClock()
    private val repository = DefaultTrackerRepository(db, TrackerSync(db, FakeTrackerService(), FakeExerciseService(), FakeTokens(), clock), scheduler, clock)
    private val outbox = db.outboxDao()

    @After fun close() = db.close()

    private suspend fun seed(vararg habits: com.trackbit.core.model.TodayHabit, day: java.time.LocalDate = DAY) =
        db.syncDao().applyToday(todayResponse(day, *habits))

    @Test fun `a write changes Room and queues its op in one go, then starts a flush`() = runTest {
        seed(todayHabit(1))

        assertEquals(WriteResult.Queued, repository.increment(1, DAY, 2))

        assertEquals(2, db.dayLogDao().get(1, DAY)!!.rating)
        val op = outbox.oldest()!!
        assertEquals(OutboxOpType.Increment, op.type)
        assertEquals(IncrementRequest(1, 2, DAY), TrackbitJson.decodeFromString<IncrementRequest>(op.payload))
        assertEquals(DAY, op.localDay)
        assertEquals(1, scheduler.flushes)
    }

    @Test fun `toggle sends the absolute value it switched to`() = runTest {
        seed(todayHabit(1, type = HabitType.Check))

        repository.toggle(1, DAY)
        repository.toggle(1, DAY)

        assertEquals(0, db.dayLogDao().get(1, DAY)!!.rating)
        val first = outbox.oldest()!!
        assertEquals(CheckRequest(1, 1, DAY), TrackbitJson.decodeFromString<CheckRequest>(first.payload))
        outbox.delete(first.id)
        assertEquals(CheckRequest(1, 0, DAY), TrackbitJson.decodeFromString<CheckRequest>(outbox.oldest()!!.payload))
    }

    @Test fun `every write extends the first log day`() = runTest {
        seed(todayHabit(1, isAntiHabit = true))

        repository.ensureDayLog(1, DAY.minusDays(2))

        assertEquals(DAY.minusDays(2), db.habitDao().get(1)!!.firstLogDay)
    }

    @Test fun `frozen and unknown habits are refused without queuing anything`() = runTest {
        seed(todayHabit(1, frozen = true))

        assertEquals(WriteResult.HabitFrozen, repository.setRating(1, DAY, 1))
        assertEquals(WriteResult.HabitNotFound, repository.setRating(7, DAY, 1))

        assertNull(outbox.oldest())
        assertNull(db.dayLogDao().get(1, DAY))
        assertEquals(0, scheduler.flushes)
    }

    @Test fun `observeDay shows the optimistic value, progress and streak`() = runTest {
        seed(todayHabit(1, streakBeforeDay = 4))

        repository.increment(1, DAY, 1)
        val habit = repository.observeDay(DAY).first().single()

        assertEquals(1, habit.today.rating)
        assertEquals(ProgressState.Halfway, habit.progress.state)
        assertEquals(5, habit.streak)
        assertEquals(1, repository.pendingWrites.first())
    }

    @Test fun `after midnight the streak bridges the last synced day`() = runTest {
        seed(todayHabit(1, streakBeforeDay = 4, recent = listOf(RecentDay(DAY, 1, 0))))
        val tomorrow = DAY.plusDays(1)

        assertEquals(0, repository.observeHabit(1, tomorrow).first()!!.streak)
        repository.increment(1, tomorrow, 1)
        assertEquals(6, repository.observeHabit(1, tomorrow).first()!!.streak)
    }

    @Test fun `the streak is unknown when the sync is too old to bridge`() = runTest {
        seed(todayHabit(1, streakBeforeDay = 4))
        val weekLater = DAY.plusDays(7)
        repository.increment(1, weekLater, 1)

        assertNull(repository.observeHabit(1, weekLater).first()!!.streak)
    }

    @Test fun `an earlier day's streak walks back through the synced week`() = runTest {
        val recent = listOf(RecentDay(DAY.minusDays(3), 1, 0), RecentDay(DAY.minusDays(2), 1, 0))
        seed(todayHabit(1, firstLogDay = DAY.minusDays(30), streakBeforeDay = 2, recent = recent))

        repository.increment(1, DAY.minusDays(1), 1)

        assertEquals(3, repository.observeHabit(1, DAY.minusDays(1)).first()!!.streak)
        assertNull("the week before the sync is unknown", repository.observeHabit(1, DAY.minusDays(8)).first()!!.streak)
    }

    @Test fun `stopping a timer adds its time to the day it started on, once`() = runTest {
        seed(todayHabit(1, type = HabitType.Timed, recent = listOf(RecentDay(DAY, 60_000, 0))))

        assertEquals(WriteResult.Queued, repository.startTimer(1, DAY))
        assertEquals(0, scheduler.flushes) // nothing to send while it runs
        clock.advanceMs(90_000)
        assertEquals(WriteResult.Queued, repository.stopTimer(1))
        assertEquals(WriteResult.NoChange, repository.stopTimer(1))

        assertEquals(150_000, db.dayLogDao().get(1, DAY)!!.rating)
        val op = outbox.oldest()!!
        assertEquals(IncrementRequest(1, 90_000, DAY), TrackbitJson.decodeFromString<IncrementRequest>(op.payload))
        outbox.delete(op.id)
        assertNull(outbox.oldest())
        assertEquals(1, scheduler.flushes)
        assertNull(repository.observeHabit(1, DAY).first()!!.timer)
    }

    @Test fun `a timer that runs past midnight logs to the day it started on`() = runTest {
        seed(todayHabit(1, type = HabitType.Timed))
        repository.startTimer(1, DAY)
        clock.advanceMs(60_000)

        repository.stopTimer(1)

        assertEquals(60_000, db.dayLogDao().get(1, DAY)!!.rating)
        assertNull(db.dayLogDao().get(1, DAY.plusDays(1)))
    }

    @Test fun `one timer per habit, only for timed habits that aren't frozen`() = runTest {
        seed(todayHabit(1, type = HabitType.Timed), todayHabit(2), todayHabit(3, type = HabitType.Timed, frozen = true))

        repository.startTimer(1, DAY)
        val started = repository.observeHabit(1, DAY).first()!!.timer
        clock.advanceMs(5_000)

        assertEquals(WriteResult.NoChange, repository.startTimer(1, DAY))
        assertEquals(started, repository.observeHabit(1, DAY).first()!!.timer)
        assertEquals(WriteResult.NoChange, repository.startTimer(2, DAY))
        assertEquals(WriteResult.HabitFrozen, repository.startTimer(3, DAY))
        assertEquals(WriteResult.HabitNotFound, repository.startTimer(9, DAY))
        assertEquals(listOf(1), repository.observeRunningTimers().first().map { it.id })
    }

    @Test fun `a running timer shows its time live on its own day only`() = runTest {
        seed(todayHabit(1, type = HabitType.Timed, recent = listOf(RecentDay(DAY, 60_000, 0))))
        repository.startTimer(1, DAY)
        val start = clock.now
        clock.advanceMs(30_000)

        val today = repository.observeDay(DAY).first().single()
        assertEquals(HabitTimer(start, DAY), today.timer)
        assertEquals(90_000, today.progressAt(clock.now).value)
        assertEquals(start.minusMillis(60_000), today.timerBase)

        val tomorrow = repository.observeHabit(1, DAY.plusDays(1)).first()!!
        assertEquals(0, tomorrow.progressAt(clock.now).value)
        assertEquals(start, tomorrow.timerBase)
    }

    @Test fun `adding to a timer moves its start back`() = runTest {
        seed(todayHabit(1, type = HabitType.Timed))
        repository.startTimer(1, DAY)

        assertEquals(WriteResult.Queued, repository.addToTimer(1, 30_000))
        assertEquals(WriteResult.NoChange, repository.addToTimer(2, 30_000))
        repository.stopTimer(1)

        assertEquals(30_000, db.dayLogDao().get(1, DAY)!!.rating)
    }

    @Test fun `a timer is dropped with its habit, or without logging once the habit is frozen`() = runTest {
        seed(todayHabit(1, type = HabitType.Timed), todayHabit(2, type = HabitType.Timed))
        repository.startTimer(1, DAY)
        repository.startTimer(2, DAY)
        clock.advanceMs(1_000)

        seed(todayHabit(2, type = HabitType.Timed, frozen = true)) // habit 1 deleted on the server
        assertEquals(listOf(2), repository.observeRunningTimers().first().map { it.id })
        assertEquals(WriteResult.HabitFrozen, repository.stopTimer(2))

        assertEquals(emptyList<TrackedHabit>(), repository.observeRunningTimers().first())
        assertNull(outbox.oldest())
    }
}
