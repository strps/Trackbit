package com.trackbit.core.network

import com.trackbit.core.model.ChangePasswordRequest
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.AppendListItemRequest
import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseListReorderRequest
import com.trackbit.core.model.ExerciseListRequest
import com.trackbit.core.model.ExerciseRequest
import com.trackbit.core.model.GradientPresets
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitRequest
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.model.SignUpRequest
import com.trackbit.core.model.UpdateUserRequest
import com.trackbit.core.network.service.AuthService
import com.trackbit.core.network.service.ExerciseListService
import com.trackbit.core.network.service.ExerciseService
import com.trackbit.core.network.service.HabitsService
import com.trackbit.core.network.service.TrackerService
import com.trackbit.core.network.service.changePassword
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
    private val exercises = server.service<ExerciseService>()
    private val habits = server.service<HabitsService>()
    private val lists = server.service<ExerciseListService>()

    @After fun tearDown() = server.close()

    private companion object {
        const val HABIT = "00000000-0000-4000-8000-000000000201"
        const val ROW = "00000000-0000-4000-8000-000000000301"
        const val LIST = "00000000-0000-4000-8000-000000000401"
    }

    private suspend fun increment(): ApiError =
        (safeCall { tracker.increment(IncrementRequest(HABIT, 1), IdempotencyKey.random()) } as ApiResult.Failure).error

    private suspend fun createHabit(): ApiError {
        val request = HabitRequest(
            "Stretch", HabitType.Timed, false, 5, 20, ColorTheme.Green, GradientPresets.getValue(ColorTheme.Custom), HabitIcon.Star,
        )
        return (safeCall { habits.create(request) } as ApiResult.Failure).error
    }

    private val exerciseRequest = ExerciseRequest("Dips", null, ExerciseCategory.Strength, listOf(1))

    private suspend fun createExercise(): ApiError =
        (safeCall { exercises.createExercise(exerciseRequest) } as ApiResult.Failure).error

    private suspend fun listError(call: suspend () -> Any): ApiError = (safeCall { call() } as ApiResult.Failure).error

    private suspend fun createList(): ApiError = listError { lists.create(ExerciseListRequest("Legs", null)) }

    private suspend fun appendTo(): ApiError =
        listError { lists.append(LIST, AppendListItemRequest("00000000-0000-4000-8000-000000000402", ROW)) }

    private suspend fun signIn(): ApiResult<String> = auth.signIn("a@test.local", "password-1234")

    private suspend fun signUp(): ApiError =
        (safeCall { auth.signUp(SignUpRequest("Ada", "a@test.local", "password-1234", "en", "UTC", "CODE")) } as ApiResult.Failure).error

    private suspend fun changePassword(): ApiResult<String> =
        auth.changePassword(ChangePasswordRequest("password-1234", "password-5678"))

    /** What the app makes of each contract. A newly recorded contract must be added here. */
    private val expectations: Map<String, suspend () -> Unit> = mapOf(
        "habit-frozen.json" to { assertEquals(ApiError.HabitFrozen, increment()) },
        "custom-exercise-frozen.json" to { assertEquals(ApiError.CustomExerciseFrozen, increment()) },
        "habit-limit-reached.json" to { assertEquals(ApiError.HabitLimitReached(10), createHabit()) },
        "habit-type-not-allowed.json" to { assertEquals(ApiError.HabitTypeNotAllowed(listOf("count", "complex")), createHabit()) },
        // The form never sends it (the switch hides for structured sessions); a plain 400 if it did.
        "anti-habit-not-allowed.json" to {
            assertEquals(ApiError.Validation("Structured sessions cannot be anti-habits.", emptyList(), "anti_habit_not_allowed"), createHabit())
        },
        "custom-exercise-frozen-update.json" to {
            val result = safeCall { exercises.updateExercise(ROW, exerciseRequest) } as ApiResult.Failure
            assertEquals(ApiError.CustomExerciseFrozen, result.error)
        },
        "custom-exercise-limit-reached.json" to { assertEquals(ApiError.CustomExerciseLimitReached(5), createExercise()) },
        "exercise-name-taken.json" to { assertEquals(ApiError.ExerciseNameTaken, createExercise()) },
        // The form only offers groups the server listed; one deleted meanwhile is a plain 400.
        "muscle-group-not-found.json" to {
            assertEquals(
                ApiError.Validation("One or more muscle groups do not exist.", emptyList(), "muscle_group_not_found"),
                createExercise(),
            )
        },
        "exercise-list-name-taken.json" to { assertEquals(ApiError.ExerciseListNameTaken, createList()) },
        "exercise-list-limit-reached.json" to { assertEquals(ApiError.ExerciseListLimitReached(3), createList()) },
        "exercise-list-frozen.json" to { assertEquals(ApiError.ExerciseListFrozen, appendTo()) },
        "exercise-list-order-frozen.json" to {
            assertEquals(ApiError.ExerciseListFrozen, listError { lists.reorder(ExerciseListReorderRequest(listOf(LIST))) })
        },
        "exercise-list-full.json" to { assertEquals(ApiError.ExerciseListFull(100), appendTo()) },
        "exercise-list-not-found.json" to {
            assertEquals(ApiError.NotFound("Exercise list not found"), listError { lists.update(LIST, ExerciseListRequest("Ghost", null)) })
        },
        "habit-not-found.json" to { assertEquals(ApiError.NotFound("Habit not found"), increment()) },
        "habit-not-found-update.json" to {
            val request = HabitRequest(
                "Gone", HabitType.Count, false, 5, 1, ColorTheme.Green, GradientPresets.getValue(ColorTheme.Custom), HabitIcon.Star,
            )
            assertEquals(ApiError.NotFound("Habit not found"), listError { habits.update(HABIT, request) })
        },
        "exercise-source-not-found.json" to {
            val result = safeCall { exercises.source("list:$LIST") } as ApiResult.Failure
            assertEquals(ApiError.NotFound("Exercise source not found"), result.error)
        },
        "validation.json" to {
            val error = increment() as ApiError.Validation
            assertEquals("Validation failed", error.message)
            assertEquals(listOf("delta", "day", "day"), error.issues.map { it.path })
        },
        "idempotency-key-invalid.json" to {
            assertEquals(ApiError.Validation("Idempotency-Key must be at most 255 characters", emptyList(), "idempotency_key_invalid"), increment())
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
        "sign-up-email-taken.json" to {
            assertEquals(
                ApiError.Unknown(422, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "User already exists. Use another email."),
                signUp(),
            )
        },
        "sign-up-password-too-short.json" to {
            assertEquals(ApiError.Validation("Password too short", emptyList(), "PASSWORD_TOO_SHORT"), signUp())
        },
        "sign-up-invite-invalid.json" to {
            assertEquals(ApiError.Validation("Invalid invitation code.", emptyList(), "INVITE_CODE_INVALID"), signUp())
        },
        "sign-up-invite-used-up.json" to {
            assertEquals(
                ApiError.Validation("This invitation code has reached its maximum uses.", emptyList(), "INVITE_CODE_MAX_USES"),
                signUp(),
            )
        },
        "sign-up-invite-expired.json" to {
            assertEquals(ApiError.Validation("This invitation code has expired.", emptyList(), "INVITE_CODE_EXPIRED"), signUp())
        },
        "change-password-invalid.json" to {
            assertEquals(ApiResult.Failure(ApiError.Validation("Invalid password", emptyList(), "INVALID_PASSWORD")), changePassword())
        },
        "change-password-too-short.json" to {
            assertEquals(ApiResult.Failure(ApiError.Validation("Password too short", emptyList(), "PASSWORD_TOO_SHORT")), changePassword())
        },
        "update-user-invalid-name.json" to {
            assertEquals(
                ApiResult.Failure(ApiError.Validation("Invalid name", emptyList(), "INVALID_NAME")),
                safeCall { auth.updateUser(UpdateUserRequest(" ")) },
            )
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
