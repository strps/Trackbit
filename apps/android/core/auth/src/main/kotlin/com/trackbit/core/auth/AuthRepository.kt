package com.trackbit.core.auth

import com.trackbit.core.auth.di.AuthScope
import com.trackbit.core.model.AccountRules
import com.trackbit.core.model.PasswordResetRequest
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.SignUpRequest
import com.trackbit.core.model.VerificationEmailRequest
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.safeCall
import com.trackbit.core.network.service.AuthService
import com.trackbit.core.network.service.session
import com.trackbit.core.network.service.signIn
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject

interface AuthRepository {
    val state: StateFlow<AuthState>

    /** Signs in with email and password and caches the user. Failures leave the state as is. */
    suspend fun signIn(email: String, password: String): ApiResult<SessionUser>

    /**
     * Creates an account in the app's language and the device's zone. It starts no session: the
     * user verifies the emailed link (on the web), then signs in. A blank [inviteCode] is none.
     */
    suspend fun signUp(name: String, email: String, password: String, inviteCode: String?): ApiResult<Unit>

    /** Emails a link to the web's reset page; succeeds whether or not the account exists. */
    suspend fun requestPasswordReset(email: String): ApiResult<Unit>

    /** Emails a new verification link; succeeds whether or not the account exists. */
    suspend fun resendVerificationEmail(email: String): ApiResult<Unit>

    /** Signs out locally at once, then revokes the session on the server if it can. */
    suspend fun signOut()

    /**
     * Checks the session with the server and updates the cached user. A rejected session signs
     * out; no connection keeps the cached session, so the app still starts offline.
     */
    suspend fun refresh()
}

internal class DefaultAuthRepository @Inject constructor(
    private val store: SessionStore,
    private val authService: AuthService,
    @AuthScope private val scope: CoroutineScope,
) : AuthRepository {
    override val state: StateFlow<AuthState> get() = store.state

    override suspend fun signIn(email: String, password: String): ApiResult<SessionUser> {
        val token = when (val result = authService.signIn(email, password)) {
            is ApiResult.Failure -> return result
            is ApiResult.Success -> result.value
        }
        // Adopt the token only once the server has confirmed it and said whose it is.
        return when (val result = authService.session(token)) {
            is ApiResult.Failure -> result
            is ApiResult.Success -> {
                val user = result.value?.user
                    ?: return ApiResult.Failure(
                        ApiError.Unknown(status = 200, code = null, message = "get-session rejected the new token"),
                    )
                store.save(StoredSession(token, user))
                ApiResult.Success(user)
            }
        }
    }

    override suspend fun signUp(name: String, email: String, password: String, inviteCode: String?): ApiResult<Unit> {
        val request = SignUpRequest(
            name = name,
            email = email,
            password = password,
            // Signed out, this is the language the app is showing.
            locale = AccountRules.signUpLocale(store.language().toLanguageTag()),
            timezone = ZoneId.systemDefault().id,
            inviteCode = inviteCode?.trim()?.takeIf { it.isNotEmpty() },
        )
        return safeCall { authService.signUp(request) }
    }

    override suspend fun requestPasswordReset(email: String): ApiResult<Unit> =
        safeCall { authService.requestPasswordReset(PasswordResetRequest(email)) }

    override suspend fun resendVerificationEmail(email: String): ApiResult<Unit> =
        safeCall { authService.sendVerificationEmail(VerificationEmailRequest(email)) }

    override suspend fun signOut() {
        val token = store.token() ?: return
        store.clear(ifToken = token)
        // Outlives the caller (a screen being closed); offline, the session simply expires.
        scope.launch { safeCall { authService.signOut("Bearer $token") } }
    }

    override suspend fun refresh() {
        val token = store.token() ?: return
        when (val result = authService.session(token)) {
            is ApiResult.Success -> when (val session = result.value) {
                null -> store.clear(ifToken = token)
                else -> store.updateUser(ifToken = token, user = session.user)
            }
            is ApiResult.Failure -> if (result.error is ApiError.Unauthorized) store.clear(ifToken = token)
        }
    }
}
