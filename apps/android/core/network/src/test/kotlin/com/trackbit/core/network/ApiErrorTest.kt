package com.trackbit.core.network

import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.network.service.TrackerService
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ApiErrorTest {
    private val server = TestServer()
    private val tracker = server.service<TrackerService>()

    @After fun tearDown() = server.close()

    private suspend fun incrementFailing(code: Int, body: String): ApiError {
        server.enqueue(code, body)
        val result = safeCall { tracker.increment(IncrementRequest(3, 1), IdempotencyKey.random()) }
        return (result as ApiResult.Failure).error
    }

    @Test fun `maps a frozen habit`() = runTest {
        val body = """{"error":"habit_frozen","message":"This habit is frozen…","habitId":3}"""
        assertEquals(ApiError.HabitFrozen(3), incrementFailing(403, body))
    }

    @Test fun `maps a frozen custom exercise`() = runTest {
        val body = """{"error":"custom_exercise_frozen","message":"…","exerciseId":9}"""
        assertEquals(ApiError.CustomExerciseFrozen(9), incrementFailing(403, body))
    }

    @Test fun `maps other 403s by their code`() = runTest {
        val error = incrementFailing(403, """{"error":"habit_limit_reached","message":"Limit"}""")
        assertEquals(ApiError.Unknown(403, "habit_limit_reached", "Limit"), error)
    }

    @Test fun `maps 404 with its localized message`() = runTest {
        assertEquals(ApiError.NotFound("Hábito no encontrado"), incrementFailing(404, """{"error":"Hábito no encontrado"}"""))
    }

    @Test fun `maps formatZodError's issues`() = runTest {
        val body = """{"message":"Validation failed","errors":[{"path":"dailyGoal","message":"Too small","code":"too_small"}]}"""
        assertEquals(
            ApiError.Validation("Validation failed", listOf(ValidationIssue("dailyGoal", "Too small"))),
            incrementFailing(400, body),
        )
    }

    @Test fun `maps a 400 without field errors`() = runTest {
        val body = """{"error":"idempotency_key_invalid","message":"Idempotency-Key must be at most 255 characters"}"""
        assertEquals(ApiError.Validation("Idempotency-Key must be at most 255 characters", emptyList()), incrementFailing(400, body))
    }

    @Test fun `maps an in-progress idempotent request as retryable`() = runTest {
        val body = """{"error":"idempotency_request_in_progress","message":"Still processing"}"""
        assertEquals(ApiError.RequestInProgress, incrementFailing(409, body))
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
