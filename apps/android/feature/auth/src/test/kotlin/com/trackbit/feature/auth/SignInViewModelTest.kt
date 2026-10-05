package com.trackbit.feature.auth

import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
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
        assertTrue(auth.signIns.isEmpty())
    }

    @Test fun `sends the trimmed email and stays submitting on success`() {
        fill()
        viewModel.submit()
        assertTrue(viewModel.state.submitting)
        auth.signInResult.complete(ApiResult.Success(USER))
        assertEquals(listOf("ada@example.com" to "hunter22"), auth.signIns)
        assertTrue(viewModel.state.submitting)
        assertFalse(viewModel.state.canSubmit)
    }

    @Test fun `a second submit while one is running is ignored`() {
        fill()
        viewModel.submit()
        viewModel.submit()
        assertEquals(1, auth.signIns.size)
    }

    @Test fun `failures map to messages and re-enable the form`() {
        fill()
        viewModel.submit()
        auth.signInResult.complete(ApiResult.Failure(ApiError.Unauthorized("INVALID_EMAIL_OR_PASSWORD", "Invalid")))
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

    private fun failUnverified() {
        fill()
        viewModel.submit()
        auth.signInResult.complete(ApiResult.Failure(ApiError.Unknown(403, "EMAIL_NOT_VERIFIED", "Email not verified")))
    }

    @Test fun `an unverified account can ask for a new link, once at a time`() {
        failUnverified()
        viewModel.resendVerification()
        viewModel.resendVerification()
        assertEquals(ResendState.Sending, viewModel.state.resend)
        assertEquals(listOf("ada@example.com"), auth.resends)
        auth.resendResult.complete(ApiResult.Success(Unit))
        assertEquals(ResendState.Sent, viewModel.state.resend)
    }

    @Test fun `a failed resend says so and offers the button again`() {
        failUnverified()
        viewModel.resendVerification()
        auth.resendResult.complete(ApiResult.Failure(ApiError.Network(IOException())))
        assertEquals(ResendState.Failed, viewModel.state.resend)
    }

    @Test fun `resending is only offered for an unverified account`() {
        fill()
        viewModel.submit()
        auth.signInResult.complete(ApiResult.Failure(ApiError.Unauthorized(null, null)))
        viewModel.resendVerification()
        assertTrue(auth.resends.isEmpty())
    }

    @Test fun `editing the email withdraws the offer and ignores a late answer`() {
        failUnverified()
        viewModel.resendVerification()
        viewModel.onEmailChange("other@example.com")
        auth.resendResult.complete(ApiResult.Success(Unit))
        assertEquals(ResendState.Idle, viewModel.state.resend)
        assertNull(viewModel.state.error)
    }
}
