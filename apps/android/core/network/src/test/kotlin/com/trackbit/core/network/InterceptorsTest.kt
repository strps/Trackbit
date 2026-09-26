package com.trackbit.core.network

import com.trackbit.core.model.CheckRequest
import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.network.service.HabitsService
import com.trackbit.core.network.service.TrackerService
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

class InterceptorsTest {
    private val tokens = FakeTokens()
    private val server = TestServer(tokens)
    private val tracker = server.service<TrackerService>()

    @After fun tearDown() = server.close()

    @Test fun `sends the bearer token when signed in`() = runTest {
        tokens.token = "abc.sig"
        server.enqueue(200, "[]")
        server.service<HabitsService>().habits()
        assertEquals("Bearer abc.sig", server.takeRequest().headers["Authorization"])
    }

    @Test fun `sends no Authorization header when signed out`() = runTest {
        server.enqueue(200, "[]")
        server.service<HabitsService>().habits()
        assertNull(server.takeRequest().headers["Authorization"])
    }

    @Test fun `reports a 401 with the token that was rejected`() = runTest {
        tokens.token = "old"
        server.enqueue(401, """{"error":"Unauthorized"}""")
        safeCall { server.service<HabitsService>().habits() }
        assertEquals(listOf("old"), tokens.rejected)
    }

    @Test fun `a 401 without a token is not a lost session`() = runTest {
        server.enqueue(401, """{"code":"INVALID_EMAIL_OR_PASSWORD"}""")
        safeCall { server.service<HabitsService>().habits() }
        assertTrue(tokens.rejected.isEmpty())
    }

    @Test fun `sends Accept-Language`() = runTest {
        server.enqueue(200, "[]")
        server.service<HabitsService>().habits()
        assertTrue(server.takeRequest().headers["Accept-Language"]!!.isNotEmpty())
    }

    @Test fun `turns the key tag into the Idempotency-Key header`() = runTest {
        server.enqueue(200, DAY_LOG_JSON)
        tracker.increment(IncrementRequest(habitId = 3, delta = 1), IdempotencyKey("k-1"))
        assertEquals("k-1", server.takeRequest().headers["Idempotency-Key"])
    }

    @Test fun `leaves day out of the body when null, sends it when set`() = runTest {
        server.enqueue(200, DAY_LOG_JSON)
        server.enqueue(200, DAY_LOG_JSON)
        tracker.check(CheckRequest(habitId = 3, rating = 1), IdempotencyKey.random())
        tracker.check(CheckRequest(habitId = 3, rating = 1, day = LocalDate.of(2026, 9, 25)), IdempotencyKey.random())
        assertEquals("""{"habitId":3,"rating":1}""", server.takeRequest().body!!.utf8())
        assertEquals("""{"habitId":3,"rating":1,"day":"2026-09-25"}""", server.takeRequest().body!!.utf8())
    }

    @Test fun `passes day as a query parameter`() = runTest {
        server.enqueue(200, """{"day":"2026-09-25","habits":[]}""")
        val today = tracker.today(LocalDate.of(2026, 9, 25))
        assertEquals("/api/tracker/today?day=2026-09-25", server.takeRequest().target)
        assertEquals(LocalDate.of(2026, 9, 25), today.day)
    }

    @Test fun `omits day when asking for the server's today`() = runTest {
        server.enqueue(200, """{"day":"2026-09-26","habits":[]}""")
        tracker.today()
        assertEquals("/api/tracker/today", server.takeRequest().target)
    }
}
