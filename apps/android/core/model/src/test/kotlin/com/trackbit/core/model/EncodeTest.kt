package com.trackbit.core.model

import com.trackbit.core.model.serialization.TrackbitJson
import kotlinx.serialization.SerializationException
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class EncodeTest {
    @Test fun `a null day is left out of the body`() {
        assertEquals("""{"habitUuid":"h","delta":1}""", TrackbitJson.encodeToString(IncrementRequest("h", 1)))
        assertEquals("""{"habitUuid":"h"}""", TrackbitJson.encodeToString(EnsureDayLogRequest("h")))
    }

    @Test fun `a day is sent as YYYY-MM-DD`() {
        assertEquals(
            """{"habitUuid":"h","rating":1,"day":"2026-09-26"}""",
            TrackbitJson.encodeToString(CheckRequest("h", 1, day("2026-09-26"))),
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun `an increment of 0 is rejected`() {
        IncrementRequest("h", 0)
    }

    @Test fun `a habit update encodes the form's fields with wire names, and no uuid`() {
        val request = HabitRequest(
            name = "Stretch",
            type = HabitType.Timed,
            isAntiHabit = false,
            weeklyGoal = 5,
            dailyGoal = 90,
            colorTheme = ColorTheme.Custom,
            colorStops = listOf(ColorStop(0f, Rgba(255f, 0f, 0f, 0.5f))),
            icon = HabitIcon.Trees,
        )
        assertEquals(
            """{"name":"Stretch","type":"timed","isAntiHabit":false,"weeklyGoal":5,"dailyGoal":90,""" +
                """"colorTheme":"custom","colorStops":[{"position":0.0,"color":[255.0,0.0,0.0,0.5]}],"icon":"trees"}""",
            TrackbitJson.encodeToString(HabitRequest.serializer(), request),
        )
        val create = TrackbitJson.encodeToString(HabitRequest.serializer(), request.copy(uuid = "h"))
        assertTrue(create, create.endsWith(""""icon":"trees","uuid":"h"}"""))
    }

    @Test fun `a log names its exercise and list item by uuid, an ad-hoc one with a null item`() {
        assertEquals(
            """{"uuid":"l","exerciseSessionUuid":"s","exerciseUuid":"e","listItemUuid":null}""",
            TrackbitJson.encodeToString(CreateExerciseLogRequest("l", "s", "e", listItemUuid = null)),
        )
    }

    @Test fun `enums encode to their wire names`() {
        assertEquals("\"timed\"", TrackbitJson.encodeToString(HabitType.Timed))
        assertEquals("\"trees\"", TrackbitJson.encodeToString(HabitIcon.Trees))
    }

    @Test(expected = SerializationException::class)
    fun `a fallback value is never sent`() {
        TrackbitJson.encodeToString(HabitType.Unknown)
    }

    @Test fun `color stops encode as rgba`() {
        val stop = ColorStop(0.5f, Rgba(255f, 225f, 0f))
        assertEquals("""{"position":0.5,"color":[255.0,225.0,0.0,1.0]}""", TrackbitJson.encodeToString(stop))
    }

    @Test fun `browse mode is sent as an explicit null source`() {
        assertEquals("""{"preferredExerciseSource":null}""", TrackbitJson.encodeToString(PreferredExerciseSourceRequest(null)))
        assertEquals("""{"preferredExerciseSource":"list:0f0e"}""", TrackbitJson.encodeToString(PreferredExerciseSourceRequest("list:0f0e")))
    }
}
