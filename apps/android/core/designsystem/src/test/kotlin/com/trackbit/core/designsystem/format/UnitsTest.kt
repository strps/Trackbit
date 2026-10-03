package com.trackbit.core.designsystem.format

import com.trackbit.core.model.UnitSystem
import org.junit.Assert.assertEquals
import org.junit.Test

class UnitsTest {
    @Test fun `weights show in the user's unit and go back in kilograms, like the web`() {
        assertEquals(60.0, kgToDisplay(60.0, UnitSystem.Metric), 0.0)
        assertEquals("to the nearest half pound", 132.5, kgToDisplay(60.0, UnitSystem.Imperial), 0.0)
        assertEquals(60.1, displayToKg(132.5, UnitSystem.Imperial), 0.0)
        assertEquals(62.5, displayToKg(62.5, UnitSystem.Metric), 0.0)
        assertEquals("lbs", weightUnit(UnitSystem.Imperial))
        assertEquals("kg", weightUnit(UnitSystem.Unknown))
    }

    @Test fun `numbers drop trailing zeros and steps don't drift`() {
        assertEquals("60", formatNumber(60.0))
        assertEquals("62.5", formatNumber(62.5))
        assertEquals(0.3, round(0.1 + 0.2, 2), 0.0)
    }
}
