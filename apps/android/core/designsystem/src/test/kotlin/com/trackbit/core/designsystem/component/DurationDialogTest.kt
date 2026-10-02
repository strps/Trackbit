package com.trackbit.core.designsystem.component

import org.junit.Assert.assertEquals
import org.junit.Test

class DurationDialogTest {
    @Test fun `time entry accepts minutes and seconds within the day's range`() {
        assertEquals(90_000L, timeMs("1", "30"))
        assertEquals(0L, timeMs("", ""))
        assertEquals(null, timeMs("1", "60"))
        assertEquals(null, timeMs("99999999", "0"))
    }
}
