package com.trackbit.feature.auth

import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.network.ApiResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.flow.MutableStateFlow

val USER = SessionUser(
    id = "u_1", name = "Ada", email = "ada@example.com", emailVerified = true, image = null,
    role = "user", locale = "en", timezone = "UTC", unitSystem = UnitSystem.Metric,
    exerciseLogCardStyle = ExerciseLogCardStyle.Classic, preferredExerciseSource = null,
)

data class SignUpCall(val name: String, val email: String, val password: String, val inviteCode: String?)

/** Records each call and answers it when the test completes the matching deferred. */
class FakeAuthRepository : AuthRepository {
    override val state = MutableStateFlow<AuthState>(AuthState.SignedOut)

    val signIns = mutableListOf<Pair<String, String>>()
    val signInResult = CompletableDeferred<ApiResult<SessionUser>>()
    val signUps = mutableListOf<SignUpCall>()
    val signUpResult = CompletableDeferred<ApiResult<Unit>>()
    val resets = mutableListOf<String>()
    val resetResult = CompletableDeferred<ApiResult<Unit>>()
    val resends = mutableListOf<String>()
    val resendResult = CompletableDeferred<ApiResult<Unit>>()

    override suspend fun signIn(email: String, password: String): ApiResult<SessionUser> {
        signIns += email to password
        return signInResult.await()
    }

    override suspend fun signUp(name: String, email: String, password: String, inviteCode: String?): ApiResult<Unit> {
        signUps += SignUpCall(name, email, password, inviteCode)
        return signUpResult.await()
    }

    override suspend fun requestPasswordReset(email: String): ApiResult<Unit> {
        resets += email
        return resetResult.await()
    }

    override suspend fun resendVerificationEmail(email: String): ApiResult<Unit> {
        resends += email
        return resendResult.await()
    }

    override suspend fun signOut() = Unit
    override suspend fun refresh() = Unit
}
