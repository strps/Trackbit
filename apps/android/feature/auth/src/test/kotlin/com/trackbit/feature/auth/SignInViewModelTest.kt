package com.trackbit.feature.auth

import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class SignInViewModelTest {
    private val auth = FakeAuthRepository()
    private lateinit var viewModel: SignInViewModel

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        viewModel = SignInViewModel(auth)
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun fill(email: String = " ada@example.com ", password: String = "hunter22") {
        viewModel.onEmailChange(email)
        viewModel.onPasswordChange(password)
    }

    @Test fun `can't submit until both fields are filled`() {
        assertFalse(viewModel.state.canSubmit)
        viewModel.onEmailChange("ada@example.com")
        assertFalse(viewModel.state.canSubmit)
        viewModel.onPasswordChange("x")
        assertTrue(viewModel.state.canSubmit)
    }

    @Test fun `a malformed email is refused locally`() {
        fill(email = "ada@example")
        viewModel.submit()
        assertEquals(SignInError.InvalidEmail, viewModel.state.error)
        assertTrue(auth.calls.isEmpty())
    }

    @Test fun `sends the trimmed email and stays submitting on success`() {
        fill()
        viewModel.submit()
        assertTrue(viewModel.state.submitting)
        auth.result.complete(ApiResult.Success(user))
        assertEquals(listOf("ada@example.com" to "hunter22"), auth.calls)
        assertTrue(viewModel.state.submitting)
        assertFalse(viewModel.state.canSubmit)
    }

    @Test fun `a second submit while one is running is ignored`() {
        fill()
        viewModel.submit()
        viewModel.submit()
        assertEquals(1, auth.calls.size)
    }

    @Test fun `failures map to messages and re-enable the form`() {
        fill()
        viewModel.submit()
        auth.result.complete(ApiResult.Failure(ApiError.Unauthorized("INVALID_EMAIL_OR_PASSWORD", "Invalid")))
        assertFalse(viewModel.state.submitting)
        assertEquals(SignInError.InvalidCredentials, viewModel.state.error)
    }

    @Test fun `editing a field clears the error`() {
        fill(email = "nope")
        viewModel.submit()
        viewModel.onEmailChange("ada@example.com")
        assertNull(viewModel.state.error)
    }

    @Test fun `maps each api error`() {
        assertEquals(SignInError.InvalidCredentials, ApiError.Unauthorized(null, null).toSignInError())
        assertEquals(
            SignInError.EmailNotVerified,
            ApiError.Unknown(403, "EMAIL_NOT_VERIFIED", "Email not verified").toSignInError(),
        )
        assertEquals(SignInError.Offline, ApiError.Network(IOException()).toSignInError())
        assertEquals(SignInError.Unexpected, ApiError.Server(500, null).toSignInError())
        assertEquals(SignInError.Unexpected, ApiError.Unknown(403, "OTHER", null).toSignInError())
    }
}

private val user = SessionUser(
    id = "u_1", name = "Ada", email = "ada@example.com", emailVerified = true, image = null,
    role = "user", locale = "en", timezone = "UTC", unitSystem = UnitSystem.Metric,
    exerciseLogCardStyle = ExerciseLogCardStyle.Classic, preferredExerciseSource = null,
)

private class FakeAuthRepository : AuthRepository {
    val calls = mutableListOf<Pair<String, String>>()
    val result = CompletableDeferred<ApiResult<SessionUser>>()
    override val state = MutableStateFlow<AuthState>(AuthState.SignedOut)

    override suspend fun signIn(email: String, password: String): ApiResult<SessionUser> {
        calls += email to password
        return result.await()
    }

    override suspend fun signOut() = Unit
    override suspend fun refresh() = Unit
}
