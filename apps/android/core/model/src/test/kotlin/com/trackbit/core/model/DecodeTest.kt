package com.trackbit.core.model

import com.trackbit.core.model.serialization.TrackbitJson
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.time.Instant

/**
 * Decodes the contracts that `apps/backend/test/contracts.test.ts` records from real responses.
 * Values a real server can't send yet (unknown enums) are inline at the end.
 */
class DecodeTest {
    private fun body(name: String): JsonElement {
        val text = checkNotNull(javaClass.getResource("/contracts/$name")) { "missing contract $name" }.readText()
        return checkNotNull(TrackbitJson.parseToJsonElement(text).jsonObject["body"])
    }

    private inline fun <reified T> contract(name: String): T = TrackbitJson.decodeFromJsonElement(body(name))

    /** The type each contract decodes to. A newly recorded contract must be added here. */
    private val decoders: Map<String, KSerializer<*>> = mapOf(
        "habits.json" to ListSerializer(Habit.serializer()),
        "habit-created.json" to Habit.serializer(),
        "day-log.json" to DayLog.serializer(),
        "today.json" to TodayResponse.serializer(),
        "exercises.json" to ListSerializer(Exercise.serializer()),
        "exercise-session.json" to ExerciseSession.serializer(),
        "exercise-log-created.json" to ExerciseLog.serializer(),
        "exercise-log.json" to ExerciseLog.serializer(),
        "exercise-performance.json" to ExercisePerformance.serializer(),
        "exercise-lists.json" to ListSerializer(ExerciseList.serializer()),
        "session.json" to SessionResponse.serializer(),
        "limits.json" to LimitsResponse.serializer(),
        "limits-admin.json" to LimitsResponse.serializer(),
    )

    @Test fun `every recorded contract decodes`() {
        val recorded = File(checkNotNull(javaClass.getResource("/contracts")).toURI()).list().orEmpty().toSet()
        assertEquals(recorded, decoders.keys)
        decoders.forEach { (name, serializer) -> TrackbitJson.decodeFromJsonElement(serializer, body(name)) }
    }

    @Test fun habits() {
        val habits = contract<List<Habit>>("habits.json").associateBy { it.name }
        val read = habits.getValue("Read")
        assertEquals(HabitType.Count, read.type)
        assertEquals(ColorTheme.Custom, read.colorTheme)
        assertEquals(HabitIcon.Book, read.icon)
        assertEquals(Rgba(255f, 225f, 0f, 0.5f), read.colorStops[1].color)
        assertTrue(habits.getValue("No sugar").isAntiHabit)
        assertEquals(HabitType.Complex, habits.getValue("Gym").type)
        val meditate = habits.getValue("Meditate")
        assertEquals(HabitType.Timed, meditate.type)
        assertTrue(meditate.frozen)
    }

    @Test fun `a created habit has no frozen flag and is not frozen`() {
        val habit = contract<Habit>("habit-created.json")
        assertFalse(habit.frozen)
        assertEquals(Instant.parse("2026-01-01T00:00:00Z"), habit.createdAt)
    }

    @Test fun dayLog() {
        val log = contract<DayLog>("day-log.json")
        assertEquals(day("2026-01-10"), log.localDay)
        assertEquals(2, log.rating)
    }

    @Test fun today() {
        val today = contract<TodayResponse>("today.json")
        assertEquals(day("2026-01-10"), today.day)
        val habits = today.habits.associateBy { it.name }

        val read = habits.getValue("Read")
        assertEquals((4..10).map { day("2026-01-%02d".format(it)) }, read.recent.map { it.day })
        assertEquals(listOf(null, null, null, 1, 3, 4, 2), read.recent.map { it.rating })
        assertEquals(day("2026-01-07"), read.firstLogDay)
        assertEquals(3, read.streakBeforeDay)

        assertEquals(1, habits.getValue("Gym").recent.single { it.day == day("2026-01-09") }.sessionCount)
        assertTrue(habits.getValue("No sugar").isAntiHabit)
        val meditate = habits.getValue("Meditate")
        assertTrue(meditate.frozen)
        assertNull(meditate.firstLogDay)
    }

    @Test fun exercises() {
        val exercises = contract<List<Exercise>>("exercises.json").associateBy { it.name }
        val system = exercises.getValue("Bench Press")
        assertNull(system.userId)
        assertNull(system.lastPerformance)
        val last = checkNotNull(exercises.getValue("My row").lastPerformance)
        assertEquals(1.25, last.distance)
        assertEquals(45_000, last.duration)
        assertEquals(Instant.parse("2026-01-01T00:00:00Z"), last.createdAt)
    }

    @Test fun `session objects`() {
        assertEquals(1, contract<ExerciseSession>("exercise-session.json").dayLogId)
        assertEquals(1, contract<ExerciseLog>("exercise-log-created.json").listItemId)
        val log = contract<ExerciseLog>("exercise-log.json")
        assertEquals(5.25, log.distance)
        assertEquals(1500, log.duration)
        val set = contract<ExercisePerformance>("exercise-performance.json")
        assertEquals(62.5, set.weight)
        assertEquals(1.25, set.distance)
        assertEquals(8, set.rpe)
    }

    @Test fun exerciseLists() {
        val item = contract<List<ExerciseList>>("exercise-lists.json").single().items.single()
        assertEquals(120, item.restSeconds)
        assertEquals(60.5, item.targetWeight)
        assertEquals(1.5, item.targetDistance)
    }

    @Test fun session() {
        val session = contract<SessionResponse>("session.json")
        assertEquals("user-id", session.session.userId)
        assertEquals("es", session.user.locale)
        assertEquals("America/Costa_Rica", session.user.timezone)
        assertEquals(UnitSystem.Imperial, session.user.unitSystem)
        assertEquals(ExerciseLogCardStyle.Compact, session.user.exerciseLogCardStyle)
        assertEquals("list:1", session.user.preferredExerciseSource)
    }

    @Test fun limits() {
        val limits = checkNotNull(contract<LimitsResponse>("limits.json").effective)
        assertEquals(listOf(HabitType.Count, HabitType.Complex), limits.allowedHabitTypes)
        assertEquals(3, limits.maxExerciseLists)
    }

    @Test fun `an admin has no limits`() {
        assertNull(contract<LimitsResponse>("limits-admin.json").effective)
    }

    @Test fun `values from a newer server fall back instead of failing the response`() {
        val json = """{"id":8,"userId":"u","name":"Levitate","description":null,"type":"levitation",
            "isAntiHabit":false,"colorTheme":"aurora","colorStops":[{"position":0,"color":[0,0,0]}],
            "icon":"Activity","weeklyGoal":7,"dailyGoal":1,"order":1,"createdAt":null,"frozen":true,
            "someNewField":{"nested":true}}"""
        val habit = TrackbitJson.decodeFromString<Habit>(json)
        assertEquals(HabitType.Unknown, habit.type)
        assertEquals(ColorTheme.Unknown, habit.colorTheme)
        assertEquals(HabitIcon.Star, habit.icon)
        assertEquals(Rgba(0f, 0f, 0f, 1f), habit.colorStops.single().color)

        val limits = """{"effective":{"maxHabits":null,"maxCustomExercises":null,"maxExerciseLists":null,
            "allowedHabitTypes":["count","teleport"]},"counts":{"habits":0,"customExercises":0,"exerciseLists":0}}"""
        assertEquals(
            listOf(HabitType.Count, HabitType.Unknown),
            TrackbitJson.decodeFromString<LimitsResponse>(limits).effective?.allowedHabitTypes,
        )
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
