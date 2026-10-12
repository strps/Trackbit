package com.trackbit.feature.exerciselibrary

import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.UnitSystem
import kotlinx.coroutines.flow.MutableStateFlow

/** Only [state]: the library reads the user's unit system from it. */
class FakeAuthRepository : AuthRepository {
    override val state = MutableStateFlow<AuthState>(AuthState.SignedOut)

    fun signIn(unitSystem: UnitSystem) {
        state.value = AuthState.SignedIn(
            SessionUser(
                id = "u_1", name = "Ada", email = "ada@example.com", emailVerified = true, image = null,
                role = "user", locale = "en", timezone = "UTC", unitSystem = unitSystem,
                exerciseLogCardStyle = ExerciseLogCardStyle.Classic, preferredExerciseSource = null,
            ),
        )
    }

    override suspend fun signIn(email: String, password: String) = error("unused")
    override suspend fun signUp(name: String, email: String, password: String, inviteCode: String?) = error("unused")
    override suspend fun requestPasswordReset(email: String) = error("unused")
    override suspend fun resendVerificationEmail(email: String) = error("unused")
    override suspend fun signOut() = error("unused")
    override suspend fun refresh() = error("unused")
}
