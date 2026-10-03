package com.trackbit.core.model

import com.trackbit.core.model.serialization.TrackbitJson
import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
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
        "habit-updated.json" to Habit.serializer(),
        "day-log.json" to DayLog.serializer(),
        "today.json" to TodayResponse.serializer(),
        "days.json" to DaysResponse.serializer(),
        "exercises.json" to ListSerializer(Exercise.serializer()),
        "sets.json" to HabitSetsResponse.serializer(),
        "exercise-session.json" to ExerciseSession.serializer(),
        "exercise-log-created.json" to ExerciseLog.serializer(),
        "exercise-log.json" to ExerciseLog.serializer(),
        "exercise-performance.json" to ExercisePerformance.serializer(),
        "exercise-sessions.json" to ListSerializer(ExerciseSessionDetail.serializer()),
        "exercise-lists.json" to ListSerializer(ExerciseList.serializer()),
        "exercise-sources.json" to ListSerializer(ExerciseSourceDescriptor.serializer()),
        "exercise-source.json" to ResolvedQueue.serializer(),
        "exercise-source-empty.json" to ResolvedQueue.serializer(),
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

    @Test fun `a habit moved to the anti-habits takes their next slot`() {
        val habit = contract<Habit>("habit-updated.json")
        assertEquals("Read more", habit.name)
        assertTrue(habit.isAntiHabit)
        assertEquals(1, habit.order)
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

    @Test fun days() {
        val days = contract<DaysResponse>("days.json")
        assertEquals(day("2026-01-01"), days.start)
        assertEquals(day("2026-01-10"), days.end)
        val gym = days.days.single { it.sessionCount > 0 }
        assertEquals(HabitDayValue(gym.habitId, day("2026-01-09"), rating = null, sessionCount = 1), gym)
        assertEquals(listOf(1, 3, 4, 2), days.days.filter { it.habitId == days.days.first().habitId }.map { it.rating })
    }

    @Test fun exercises() {
        val exercises = contract<List<Exercise>>("exercises.json").associateBy { it.name }
        val system = exercises.getValue("Bench Press")
        assertNull(system.userId)
        assertNull(system.lastPerformance)
        assertEquals(listOf(MuscleGroupRef(1, "Chest")), system.muscleGroups)
        assertEquals(emptyList<MuscleGroupRef>(), exercises.getValue("My row").muscleGroups)
        val last = checkNotNull(exercises.getValue("My row").lastPerformance)
        assertEquals(1.25, last.distance)
        assertEquals(45_000, last.duration)
        assertEquals(Instant.parse("2026-01-01T00:00:00Z"), last.createdAt)
    }

    @Test fun sets() {
        val sets = contract<HabitSetsResponse>("sets.json")
        assertEquals(
            listOf(
                HabitSet(day("2026-01-10"), exerciseId = 2, weight = 60.5, reps = 8, rpe = null, duration = null, distance = null),
                HabitSet(day("2026-01-10"), exerciseId = 2, weight = 62.5, reps = 6, rpe = 8, duration = 45_000, distance = 1.25),
            ),
            sets.sets,
        )
    }

    @Test fun `session objects`() {
        val session = contract<ExerciseSession>("exercise-session.json")
        assertEquals(1, session.dayLogId)
        assertEquals("00000000-0000-4000-8000-000000000001", session.uuid)
        assertEquals(1, contract<ExerciseLog>("exercise-log-created.json").listItemId)
        val log = contract<ExerciseLog>("exercise-log.json")
        assertEquals(5.25, log.distance)
        assertEquals(1500, log.duration)
        val set = contract<ExercisePerformance>("exercise-performance.json")
        assertEquals(62.5, set.weight)
        assertEquals(1.25, set.distance)
        assertEquals(8, set.rpe)
        assertEquals("00000000-0000-4000-8000-000000000004", set.uuid)
    }

    @Test fun `a day's sessions`() {
        val session = contract<List<ExerciseSessionDetail>>("exercise-sessions.json").single()
        assertEquals("00000000-0000-4000-8000-000000000001", session.uuid)
        val log = session.exerciseLogs.single()
        assertEquals("00000000-0000-4000-8000-000000000002", log.uuid)
        assertEquals(1, log.listItemId)
        assertEquals(listOf(1, 2), log.exercisePerformances.map { it.number })
        assertEquals(SetValues(reps = 8, weight = 60.5, duration = null, distance = null, rpe = null), log.exercisePerformances[0].values)
    }

    @Test fun `set values encode every field, null included`() {
        assertEquals(
            """{"reps":5,"weight":null,"duration":null,"distance":null,"rpe":null}""",
            TrackbitJson.encodeToString(SetValues.serializer(), SetValues.EMPTY.copy(reps = 5)),
        )
    }

    @Test fun exerciseLists() {
        val item = contract<List<ExerciseList>>("exercise-lists.json").single().items.single()
        assertEquals(120, item.restSeconds)
        assertEquals(60.5, item.targetWeight)
        assertEquals(1.5, item.targetDistance)
    }

    @Test fun exerciseSources() {
        val (pull, legs) = contract<List<ExerciseSourceDescriptor>>("exercise-sources.json")
        assertEquals("list:1", pull.key)
        assertEquals("Pull day", pull.name)
        assertNull(pull.nameKey)
        assertEquals(1, pull.itemCount)
        assertTrue(pull.capabilities.prescribes)
        assertFalse(legs.capabilities.prescribes)
        assertFalse(legs.frozen)
    }

    @Test fun exerciseSource() {
        val queue = contract<ResolvedQueue>("exercise-source.json")
        assertEquals("list:1", queue.descriptor.key)
        assertNull(queue.emptyReason)
        val entry = queue.entries.single()
        assertEquals(1, entry.listItemId)
        val prescription = checkNotNull(entry.prescription)
        assertEquals(8, prescription.targetReps)
        assertEquals(60.5, prescription.targetWeight)
        assertEquals(90, prescription.targetDuration)

        val empty = contract<ResolvedQueue>("exercise-source-empty.json")
        assertEquals(emptyList<QueueEntry>(), empty.entries)
        assertEquals(QueueEmptyReason.ListEmpty, empty.emptyReason)
    }

    @Test fun session() {
        val session = contract<SessionResponse>("session.json")
        assertEquals("user-id", session.session.userId)
        assertEquals("es", session.user.locale)
        assertEquals("America/Costa_Rica", session.user.timezone)
        assertEquals(UnitSystem.Imperial, session.user.unitSystem)
        assertEquals(ExerciseLogCardStyle.Compact, session.user.exerciseLogCardStyle)
        assertEquals("list:1", session.user.preferredExerciseSource)
        assertEquals(120, session.user.defaultRestSeconds)
    }

    @Test fun `a user cached before defaultRestSeconds existed reads the server's default`() {
        val user = JsonObject(body("session.json").jsonObject.getValue("user").jsonObject - "defaultRestSeconds")
        assertEquals(SessionUser.DEFAULT_REST_SECONDS, TrackbitJson.decodeFromJsonElement<SessionUser>(user).defaultRestSeconds)
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

        // A source kind the app doesn't know is still a source: it is named by its key only.
        val queue = """{"descriptor":{"ref":{"kind":"coach","coachId":"c"},"key":"coach:c","name":null,
            "nameKey":"source_coach","itemCount":null,"capabilities":{"canAppend":false,"canReorder":false,
            "prescribes":false,"isDynamic":true},"frozen":false},"entries":[],"emptyReason":"vacation",
            "generatedAt":"2026-01-01T00:00:00.000Z","expiresAt":"2026-01-01T00:05:00.000Z"}"""
        val decoded = TrackbitJson.decodeFromString<ResolvedQueue>(queue)
        assertEquals("coach:c", decoded.descriptor.key)
        assertEquals(QueueEmptyReason.Unknown, decoded.emptyReason)
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
