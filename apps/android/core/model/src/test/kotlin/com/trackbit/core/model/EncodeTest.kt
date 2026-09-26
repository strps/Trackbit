package com.trackbit.core.model

import com.trackbit.core.model.serialization.TrackbitJson
import kotlinx.serialization.SerializationException
import kotlinx.serialization.encodeToString
import org.junit.Assert.assertEquals
import org.junit.Test

class EncodeTest {
    @Test fun `a null day is left out of the body`() {
        assertEquals("""{"habitId":7,"delta":1}""", TrackbitJson.encodeToString(IncrementRequest(7, 1)))
        assertEquals("""{"habitId":7}""", TrackbitJson.encodeToString(EnsureDayLogRequest(7)))
    }

    @Test fun `a day is sent as YYYY-MM-DD`() {
        assertEquals(
            """{"habitId":7,"rating":1,"day":"2026-09-26"}""",
            TrackbitJson.encodeToString(CheckRequest(7, 1, day("2026-09-26"))),
        )
    }

    @Test(expected = IllegalArgumentException::class)
    fun `an increment of 0 is rejected`() {
        IncrementRequest(7, 0)
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
}
