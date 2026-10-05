package com.trackbit.core.network.service

import com.trackbit.core.model.ChangePasswordRequest
import com.trackbit.core.model.PasswordResetRequest
import com.trackbit.core.model.SessionResponse
import com.trackbit.core.model.SignInRequest
import com.trackbit.core.model.SignUpRequest
import com.trackbit.core.model.UpdateUserRequest
import com.trackbit.core.model.UpdateUserResponse
import com.trackbit.core.model.VerificationEmailRequest
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

    /** Changes the signed-in user's profile; read the new values back from `get-session`. */
    @POST("api/auth/update-user")
    suspend fun updateUser(@Body body: UpdateUserRequest): UpdateUserResponse

    /** The new session's token is in the `set-auth-token` header; see [changePassword]. */
    @POST("api/auth/change-password")
    suspend fun changePasswordRaw(@Body body: ChangePasswordRequest): Response<Unit>

    /** Creates an unverified account and emails its verification link; it starts no session. */
    @POST("api/auth/sign-up/email")
    suspend fun signUp(@Body body: SignUpRequest)

    /** Emails a link to the web's reset page, if the account exists. */
    @POST("api/auth/request-password-reset")
    suspend fun requestPasswordReset(@Body body: PasswordResetRequest)

    /** Emails a new verification link, if the account exists and is unverified. */
    @POST("api/auth/send-verification-email")
    suspend fun sendVerificationEmail(@Body body: VerificationEmailRequest)
}

/** Signs in and returns the session token to send as the bearer token. */
suspend fun AuthService.signIn(email: String, password: String): ApiResult<String> =
    newSessionToken { signInEmail(SignInRequest(email, password)) }

/**
 * Changes the password and returns the new session's token. With `revokeOtherSessions` the
 * server deletes every session, the current one too, so the caller must adopt this token.
 */
suspend fun AuthService.changePassword(request: ChangePasswordRequest): ApiResult<String> =
    newSessionToken { changePasswordRaw(request) }

/** Calls an endpoint that starts a session, and returns its token from the `set-auth-token` header. */
private suspend fun newSessionToken(call: suspend () -> Response<Unit>): ApiResult<String> {
    val result = safeCall { call().also { if (!it.isSuccessful) throw HttpException(it) } }
    return when (result) {
        is ApiResult.Failure -> result
        is ApiResult.Success -> result.value.headers()[SET_AUTH_TOKEN]
            ?.takeIf { it.isNotEmpty() }
            ?.let { ApiResult.Success(it) }
            ?: ApiResult.Failure(
                ApiError.Unknown(status = result.value.code(), code = null, message = "Response has no $SET_AUTH_TOKEN header"),
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
