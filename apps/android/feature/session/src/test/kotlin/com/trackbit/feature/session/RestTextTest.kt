package com.trackbit.feature.session

import org.junit.Assert.assertEquals
import org.junit.Test

/** The rest bar's time: rounded up while counting down, then below zero. */
class RestTextTest {
    @Test fun `counts down rounded up, then 0-00, then below zero`() {
        assertEquals("1:30", restText(90_000))
        assertEquals("0:01", restText(1))
        assertEquals("0:00", restText(0))
        assertEquals("0:00", restText(-999))
        assertEquals("−0:01", restText(-1_000))
        assertEquals("−1:05", restText(-65_500))
    }
}
