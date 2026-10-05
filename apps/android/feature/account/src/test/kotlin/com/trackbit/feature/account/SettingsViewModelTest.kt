package com.trackbit.feature.account

import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.network.ApiResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class SettingsViewModelTest {
    private val auth = FakeAuthRepository()

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    @Test fun `shows the signed-in user, and nobody once signed out`() = runTest {
        auth.state.value = AuthState.SignedIn(user)
        val viewModel = SettingsViewModel(auth)
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.user.collect {} }
        assertEquals("ada@example.com", viewModel.user.value?.email)

        auth.state.value = AuthState.SignedOut
        assertNull(viewModel.user.value)
    }
}

private val user = SessionUser(
    id = "u_1", name = "Ada", email = "ada@example.com", emailVerified = true, image = null,
    role = "user", locale = "en", timezone = "UTC", unitSystem = UnitSystem.Metric,
    exerciseLogCardStyle = ExerciseLogCardStyle.Classic, preferredExerciseSource = null,
)

private class FakeAuthRepository : AuthRepository {
    override val state = MutableStateFlow<AuthState>(AuthState.SignedOut)
    override suspend fun signIn(email: String, password: String): ApiResult<SessionUser> = error("unused")
    override suspend fun signUp(name: String, email: String, password: String, inviteCode: String?): ApiResult<Unit> = error("unused")
    override suspend fun requestPasswordReset(email: String): ApiResult<Unit> = error("unused")
    override suspend fun resendVerificationEmail(email: String): ApiResult<Unit> = error("unused")
    override suspend fun signOut() = Unit
    override suspend fun refresh() = Unit
}
