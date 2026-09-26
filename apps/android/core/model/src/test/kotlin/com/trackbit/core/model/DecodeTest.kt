package com.trackbit.core.model

import com.trackbit.core.model.serialization.TrackbitJson
import kotlinx.serialization.SerializationException
import kotlinx.serialization.decodeFromString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

/** Decodes hand-built fixtures shaped like real responses. B7 replaces them with recorded ones. */
class DecodeTest {
    private inline fun <reified T> fixture(name: String): T {
        val text = checkNotNull(javaClass.getResource("/fixtures/$name")) { "missing fixture $name" }.readText()
        return TrackbitJson.decodeFromString(text)
    }

    @Test fun habits() {
        val (known, future) = fixture<List<Habit>>("habits.json")
        assertEquals(HabitType.Count, known.type)
        assertEquals(ColorTheme.Custom, known.colorTheme)
        assertEquals(HabitIcon.Book, known.icon)
        assertEquals(Instant.parse("2026-09-20T08:30:00Z"), known.createdAt)
        assertEquals(Rgba(255f, 225f, 0f, 1f), known.colorStops[1].color)

        // Values from a newer server fall back instead of failing the response.
        assertEquals(HabitType.Unknown, future.type)
        assertEquals(ColorTheme.Unknown, future.colorTheme)
        assertEquals(HabitIcon.Star, future.icon)
        assertTrue(future.frozen)
    }

    @Test fun `habit without frozen is not frozen`() {
        val json = """{"id":1,"userId":"u","name":"n","description":null,"type":"check","isAntiHabit":false,
            "colorTheme":"green","colorStops":[],"icon":"sun","weeklyGoal":5,"dailyGoal":1,"order":0,"createdAt":null}"""
        assertFalse(TrackbitJson.decodeFromString<Habit>(json).frozen)
    }

    @Test fun dayLog() {
        val log = fixture<DayLog>("day-log.json")
        assertEquals(day("2026-09-26"), log.localDay)
        assertEquals(2, log.rating)
    }

    @Test fun today() {
        val today = fixture<TodayResponse>("today.json")
        assertEquals(day("2026-09-26"), today.day)
        val (timed, anti) = today.habits
        assertEquals(7, timed.recent.size)
        assertEquals(day("2026-09-20"), timed.recent.first().day)
        assertEquals(600_000, timed.recent[1].rating)
        assertEquals(day("2026-09-01"), timed.firstLogDay)
        assertTrue(anti.isAntiHabit)
        assertNull(anti.firstLogDay)
    }

    @Test fun exercises() {
        val (system, custom) = fixture<List<Exercise>>("exercises.json")
        assertNull(system.userId)
        assertEquals(1.25, system.lastPerformance!!.distance)
        assertEquals(Instant.parse("2026-09-26T09:14:29.658Z"), system.lastPerformance!!.createdAt)
        assertNull(custom.lastPerformance)
        assertTrue(custom.frozen)
    }

    @Test fun `session objects`() {
        assertEquals(41, fixture<ExerciseSession>("exercise-session.json").dayLogId)
        assertEquals(3, fixture<ExerciseLog>("exercise-log.json").exerciseSessionId)
        assertEquals(22.5, fixture<ExercisePerformance>("exercise-performance.json").weight)
    }

    @Test fun exerciseLists() {
        val list = fixture<List<ExerciseList>>("exercise-lists.json").single()
        val item = list.items.single()
        assertEquals(120, item.restSeconds)
        assertEquals(60.0, item.targetWeight)
    }

    @Test fun session() {
        val session = fixture<SessionResponse>("session.json")
        assertEquals(Instant.parse("2026-10-03T09:00:00Z"), session.session.expiresAt)
        assertEquals(UnitSystem.Imperial, session.user.unitSystem)
        assertEquals(ExerciseLogCardStyle.Compact, session.user.exerciseLogCardStyle)
        assertEquals("list:2", session.user.preferredExerciseSource)
    }

    @Test fun limits() {
        val limits = fixture<LimitsResponse>("limits.json")
        assertNull(limits.effective.maxCustomExercises)
        assertEquals(listOf(HabitType.Count, HabitType.Complex, HabitType.Unknown), limits.effective.allowedHabitTypes)
    }

    @Test fun `a color stop needs 3 or 4 channels`() {
        val bad = """{"position":0,"color":[1,2]}"""
        try {
            TrackbitJson.decodeFromString<ColorStop>(bad)
            throw AssertionError("expected a SerializationException")
        } catch (_: SerializationException) {
        }
    }
}
