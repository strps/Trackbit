package com.trackbit.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

class ColorStopsTest {
    private val green = GradientPresets.getValue(ColorTheme.Green)

    @Test fun `clamps to the end stops`() {
        assertEquals(Rgba(241f, 245f, 249f, 0.1f), green.colorAt(-1f))
        assertEquals(Rgba(21f, 128f, 61f, 1f), green.colorAt(2f))
    }

    @Test fun `hits a stop exactly`() {
        assertEquals(Rgba(134f, 239f, 172f, 0.4f), green.colorAt(0.4f))
    }

    @Test fun `interpolates between the surrounding stops`() {
        // Halfway from 0.4 to 1.0; the web's mapValueToColor gives rgba(78, 184, 117, 0.7).
        val c = green.colorAt(0.7f)
        assertEquals(77.5f, c.red, 0.01f)
        assertEquals(183.5f, c.green, 0.01f)
        assertEquals(116.5f, c.blue, 0.01f)
        assertEquals(0.7f, c.alpha, 0.001f)
    }

    @Test fun `accepts stops out of order`() {
        assertEquals(green.colorAt(0.7f), green.reversed().colorAt(0.7f))
    }

    @Test fun `every theme with a wire value has a preset`() {
        assertEquals(ColorTheme.entries.filter { it.wire != null }.toSet(), GradientPresets.keys)
    }
}
