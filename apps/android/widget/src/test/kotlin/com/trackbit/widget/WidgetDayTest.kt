package com.trackbit.widget

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDateTime
import java.time.ZoneId

class WidgetDayTest {
    @Test fun `the rollover is the next local midnight`() {
        val zone = ZoneId.of("America/Costa_Rica")
        val now = LocalDateTime.of(2026, 9, 28, 23, 59, 59).atZone(zone)

        assertEquals(LocalDateTime.of(2026, 9, 29, 0, 0).atZone(zone), nextMidnight(now))
    }

    @Test fun `just after midnight it is the following one`() {
        val zone = ZoneId.of("Europe/Madrid")
        val now = LocalDateTime.of(2026, 9, 28, 0, 0).atZone(zone)

        assertEquals(LocalDateTime.of(2026, 9, 29, 0, 0).atZone(zone), nextMidnight(now))
    }

    @Test fun `when DST skips midnight the day starts at 1 am`() {
        // Chile moves its clocks from 00:00 to 01:00 on 2026-09-06.
        val zone = ZoneId.of("America/Santiago")
        val now = LocalDateTime.of(2026, 9, 5, 22, 0).atZone(zone)

        assertEquals(LocalDateTime.of(2026, 9, 6, 1, 0).atZone(zone), nextMidnight(now))
    }
}
