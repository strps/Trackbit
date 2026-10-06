package com.trackbit.core.network

import kotlinx.serialization.SerializationException
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.intOrNull
import retrofit2.HttpException
import java.io.IOException

/** Why an API call failed. */
sealed interface ApiError {
    /**
     * 401. With a token, the session is gone (the auth interceptor has already reported it).
     * Without one, e.g. on sign-in, [code] says why: Better-Auth's `INVALID_EMAIL_OR_PASSWORD`.
     */
    data class Unauthorized(val code: String?, val message: String?) : ApiError

    // The frozen bodies name their row by the server's int id, which the app never uses; to say
    // which row, the server must add its uuid first.

    /** 403 `habit_frozen`: the habit is over the user's role limits and read-only. */
    data object HabitFrozen : ApiError

    /** 403 `custom_exercise_frozen`. */
    data object CustomExerciseFrozen : ApiError

    /** 403 `habit_limit_reached`: creating one more habit would pass the role's [maxHabits]. */
    data class HabitLimitReached(val maxHabits: Int?) : ApiError

    /** 403 `habit_type_not_allowed`: the role can't have this habit type; [allowed] are the wire names it can. */
    data class HabitTypeNotAllowed(val allowed: List<String>) : ApiError

    /** 403 `custom_exercise_limit_reached`: one more custom exercise would pass the role's [maxCustomExercises]. */
    data class CustomExerciseLimitReached(val maxCustomExercises: Int?) : ApiError

    /** 409 `exercise_name_taken`: the user already has a custom exercise with that name. */
    data object ExerciseNameTaken : ApiError

    /** 403 `exercise_list_frozen`: the list is over the role's cap and read-only (it can still be deleted). */
    data object ExerciseListFrozen : ApiError

    /** 403 `exercise_list_limit_reached`: one more list would pass the role's [maxExerciseLists]. */
    data class ExerciseListLimitReached(val maxExerciseLists: Int?) : ApiError

    /** 409 `exercise_list_name_taken`: the user already has a list with that name. */
    data object ExerciseListNameTaken : ApiError

    /** 400 `exercise_list_full`: the list already holds [maxItems] exercises. */
    data class ExerciseListFull(val maxItems: Int?) : ApiError

    data class NotFound(val message: String?) : ApiError

    /**
     * 400. [issues] is empty unless the route reports per-field errors. [code] is the server's
     * `error` or Better-Auth's `code` (`INVALID_PASSWORD`), when there is one.
     */
    data class Validation(val message: String?, val issues: List<ValidationIssue>, val code: String? = null) : ApiError

    /**
     * 409 `idempotency_request_in_progress`: a request with the same key is still running.
     * The one client error to retry later rather than drop.
     */
    data object RequestInProgress : ApiError

    /** 5xx. Retry with backoff. */
    data class Server(val status: Int, val message: String?) : ApiError

    /** No response: offline, timeout, connection reset. Retry with backoff. */
    data class Network(val cause: IOException) : ApiError

    /**
     * Anything else: another 4xx ([code] is the server's `error` or Better-Auth's `code`), or a
     * response that didn't decode ([status] null, [cause] set).
     */
    data class Unknown(
        val status: Int?,
        val code: String?,
        val message: String?,
        val cause: Throwable? = null,
    ) : ApiError

    companion object {
        /** Maps an HTTP error status and its body (any of the backend's error shapes). */
        fun fromResponse(status: Int, body: String?): ApiError {
            val json = body?.let { runCatching { Json.parseToJsonElement(it) as? JsonObject }.getOrNull() }
            // `error` is a machine code on some routes and a localized message on others;
            // only the codes below are matched, so either works.
            val error = json.string("error")
            val message = json.string("message") ?: error
            return when {
                status == 401 -> Unauthorized(json.string("code"), message)
                status == 403 && error == "habit_frozen" -> HabitFrozen
                status == 403 && error == "custom_exercise_frozen" -> CustomExerciseFrozen
                status == 403 && error == "habit_limit_reached" -> HabitLimitReached(json.int("maxHabits"))
                status == 403 && error == "habit_type_not_allowed" -> HabitTypeNotAllowed(json.strings("allowedHabitTypes"))
                status == 403 && error == "custom_exercise_limit_reached" -> CustomExerciseLimitReached(json.int("maxCustomExercises"))
                status == 403 && error == "exercise_list_frozen" -> ExerciseListFrozen
                status == 403 && error == "exercise_list_limit_reached" -> ExerciseListLimitReached(json.int("maxExerciseLists"))
                status == 400 && error == "exercise_list_full" -> ExerciseListFull(json.int("maxItems"))
                status == 404 -> NotFound(message)
                status == 400 -> Validation(message, json.issues(), error ?: json.string("code"))
                status == 409 && error == "idempotency_request_in_progress" -> RequestInProgress
                status == 409 && error == "exercise_name_taken" -> ExerciseNameTaken
                status == 409 && error == "exercise_list_name_taken" -> ExerciseListNameTaken
                status >= 500 -> Server(status, message)
                else -> Unknown(status, error ?: json.string("code"), message)
            }
        }

        private fun JsonObject?.string(key: String): String? =
            (this?.get(key) as? JsonPrimitive)?.takeIf { it.isString }?.content

        private fun JsonObject?.int(key: String): Int? = (this?.get(key) as? JsonPrimitive)?.intOrNull

        private fun JsonObject?.strings(key: String): List<String> =
            (this?.get(key) as? JsonArray).orEmpty().mapNotNull { (it as? JsonPrimitive)?.takeIf { p -> p.isString }?.content }

        /** `formatZodError`'s `errors: [{ path, message, code }]`. */
        private fun JsonObject?.issues(): List<ValidationIssue> =
            (this?.get("errors") as? JsonArray).orEmpty().mapNotNull { issue ->
                val o = issue as? JsonObject ?: return@mapNotNull null
                ValidationIssue(path = o.string("path").orEmpty(), message = o.string("message").orEmpty())
            }
    }
}

data class ValidationIssue(val path: String, val message: String)

sealed interface ApiResult<out T> {
    data class Success<T>(val value: T) : ApiResult<T>
    data class Failure(val error: ApiError) : ApiResult<Nothing>
}

inline fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
    is ApiResult.Success -> ApiResult.Success(transform(value))
    is ApiResult.Failure -> this
}

fun <T> ApiResult<T>.getOrNull(): T? = (this as? ApiResult.Success)?.value

/**
 * Runs a service call and maps every expected failure to an [ApiError]. Cancellation and
 * programming errors still throw.
 */
suspend fun <T> safeCall(block: suspend () -> T): ApiResult<T> = try {
    ApiResult.Success(block())
} catch (e: HttpException) {
    val body = runCatching { e.response()?.errorBody()?.string() }.getOrNull()
    ApiResult.Failure(ApiError.fromResponse(e.code(), body))
} catch (e: IOException) {
    ApiResult.Failure(ApiError.Network(e))
} catch (e: SerializationException) {
    ApiResult.Failure(ApiError.Unknown(status = null, code = null, message = e.message, cause = e))
}
