package com.trackbit.core.network

import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.network.service.TrackerService
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Synthetic bodies the real server can't produce on demand. Recorded ones are in [ErrorContractTest]. */
class ApiErrorTest {
    private val server = TestServer()
    private val tracker = server.service<TrackerService>()

    @After fun tearDown() = server.close()

    private suspend fun incrementFailing(code: Int, body: String): ApiError {
        server.enqueue(code, body)
        val result = safeCall { tracker.increment(IncrementRequest(3, 1), IdempotencyKey.random()) }
        return (result as ApiResult.Failure).error
    }

    @Test fun `maps other 403s by their code`() = runTest {
        val error = incrementFailing(403, """{"error":"exercise_list_limit_reached","message":"Limit"}""")
        assertEquals(ApiError.Unknown(403, "exercise_list_limit_reached", "Limit"), error)
    }

    @Test fun `maps other conflicts to Unknown`() = runTest {
        val error = incrementFailing(409, """{"error":"habit_order_conflict"}""")
        assertEquals(ApiError.Unknown(409, "habit_order_conflict", "habit_order_conflict"), error)
    }

    @Test fun `maps 5xx, even with a non-JSON body`() = runTest {
        assertEquals(ApiError.Server(502, null), incrementFailing(502, "<html>Bad gateway</html>"))
    }

    @Test fun `maps a 200 that doesn't decode to Unknown with its cause`() = runTest {
        val error = incrementFailing(200, """{"id":"not a number"}""")
        assertTrue(error is ApiError.Unknown && error.status == null && error.cause != null)
    }

    @Test fun `maps no connection to Network`() = runTest {
        server.close()
        val result = safeCall { tracker.increment(IncrementRequest(3, 1), IdempotencyKey.random()) }
        assertTrue((result as ApiResult.Failure).error is ApiError.Network)
    }
}
