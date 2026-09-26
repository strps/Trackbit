package com.trackbit.core.network.service

import com.trackbit.core.model.SessionResponse
import com.trackbit.core.model.SignInRequest
import com.trackbit.core.model.serialization.TrackbitJson
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.safeCall
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import retrofit2.HttpException
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST

/** Better-Auth's endpoints under `/api/auth`. Prefer the extension functions below. */
interface AuthService {
    /** The token is in the `set-auth-token` header, not the body; see [signIn]. */
    @POST("api/auth/sign-in/email")
    suspend fun signInEmail(@Body body: SignInRequest): Response<Unit>

    /**
     * A [SessionResponse], or JSON `null` when the token is not valid; see [session].
     * [authorization] overrides the current session's token.
     */
    @GET("api/auth/get-session")
    suspend fun getSession(@Header("Authorization") authorization: String?): JsonElement

    /** Revokes the session [authorization] names, which may already be gone from the app. */
    @POST("api/auth/sign-out")
    suspend fun signOut(@Header("Authorization") authorization: String): Response<Unit>
}

/** Signs in and returns the session token to send as the bearer token. */
suspend fun AuthService.signIn(email: String, password: String): ApiResult<String> {
    val result = safeCall {
        signInEmail(SignInRequest(email, password)).also { if (!it.isSuccessful) throw HttpException(it) }
    }
    return when (result) {
        is ApiResult.Failure -> result
        is ApiResult.Success -> result.value.headers()[SET_AUTH_TOKEN]
            ?.takeIf { it.isNotEmpty() }
            ?.let { ApiResult.Success(it) }
            ?: ApiResult.Failure(
                ApiError.Unknown(status = result.value.code(), code = null, message = "Sign-in response has no $SET_AUTH_TOKEN header"),
            )
    }
}

/**
 * The signed-in user and session, or null when the server no longer accepts the token.
 * Better-Auth answers that case with 200 and a `null` body rather than 401.
 *
 * [token] checks a token that isn't the current session's yet, e.g. one sign-in just returned.
 * A 401 for it is not reported as a lost session.
 */
suspend fun AuthService.session(token: String? = null): ApiResult<SessionResponse?> = safeCall {
    when (val json = getSession(token?.let { "Bearer $it" })) {
        JsonNull -> null
        else -> TrackbitJson.decodeFromJsonElement(SessionResponse.serializer(), json)
    }
}

private const val SET_AUTH_TOKEN = "set-auth-token"
