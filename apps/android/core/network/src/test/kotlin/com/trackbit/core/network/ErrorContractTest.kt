package com.trackbit.core.network

import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.network.service.AuthService
import com.trackbit.core.network.service.TrackerService
import com.trackbit.core.network.service.session
import com.trackbit.core.network.service.signIn
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File

/**
 * Maps the error responses that `apps/backend/test/contracts.test.ts` records from the real
 * server, through the same Retrofit + [safeCall] path the app uses.
 */
class ErrorContractTest {
    private val tokens = FakeTokens()
    private val server = TestServer(tokens)
    private val tracker = server.service<TrackerService>()
    private val auth = server.service<AuthService>()

    @After fun tearDown() = server.close()

    private suspend fun increment(): ApiError =
        (safeCall { tracker.increment(IncrementRequest(4, 1), IdempotencyKey.random()) } as ApiResult.Failure).error

    private suspend fun signIn(): ApiResult<String> = auth.signIn("a@test.local", "password-1234")

    /** What the app makes of each contract. A newly recorded contract must be added here. */
    private val expectations: Map<String, suspend () -> Unit> = mapOf(
        "habit-frozen.json" to { assertEquals(ApiError.HabitFrozen(4), increment()) },
        "custom-exercise-frozen.json" to { assertEquals(ApiError.CustomExerciseFrozen(1), increment()) },
        "habit-not-found.json" to { assertEquals(ApiError.NotFound("Habit not found"), increment()) },
        "validation.json" to {
            val error = increment() as ApiError.Validation
            assertEquals("Validation failed", error.message)
            assertEquals(listOf("delta", "day", "day"), error.issues.map { it.path })
        },
        "idempotency-key-invalid.json" to {
            assertEquals(ApiError.Validation("Idempotency-Key must be at most 255 characters", emptyList()), increment())
        },
        // Dropped by the outbox: the key was reused for another request, so retrying can't help.
        "idempotency-key-reused.json" to {
            val error = increment() as ApiError.Unknown
            assertEquals(422 to "idempotency_key_reused", error.status to error.code)
        },
        "idempotency-request-in-progress.json" to { assertEquals(ApiError.RequestInProgress, increment()) },
        "unauthorized.json" to {
            tokens.token = "revoked"
            val result = safeCall { tracker.today() }
            tokens.token = null
            assertEquals(ApiResult.Failure(ApiError.Unauthorized(null, "Unauthorized")), result)
            assertEquals(listOf("revoked"), tokens.rejected)
        },
        "sign-in-invalid-credentials.json" to {
            assertEquals(
                ApiResult.Failure(ApiError.Unauthorized("INVALID_EMAIL_OR_PASSWORD", "Invalid email or password")),
                signIn(),
            )
        },
        "sign-in-email-not-verified.json" to {
            assertEquals(ApiResult.Failure(ApiError.Unknown(403, "EMAIL_NOT_VERIFIED", "Email not verified")), signIn())
        },
        // Better-Auth answers an unknown token with 200 and `null`, not 401.
        "get-session-signed-out.json" to { assertEquals(ApiResult.Success(null), auth.session()) },
    )

    @Test fun `every recorded contract maps as expected`() = runTest {
        val dir = File(checkNotNull(javaClass.getResource("/contracts")).toURI())
        assertEquals(dir.list().orEmpty().toSet(), expectations.keys)

        expectations.forEach { (name, check) ->
            val contract = Json.parseToJsonElement(File(dir, name).readText()).jsonObject
            server.enqueue(contract.getValue("status").jsonPrimitive.int, contract.getValue("body").toString())
            try {
                check()
            } catch (e: AssertionError) {
                throw AssertionError("$name: ${e.message}", e)
            }
        }
    }
}
