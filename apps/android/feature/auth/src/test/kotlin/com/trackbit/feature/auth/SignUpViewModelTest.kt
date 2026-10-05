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
class SignUpViewModelTest {
    private val auth = FakeAuthRepository()
    private lateinit var viewModel: SignUpViewModel

    @Before fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher())
        viewModel = SignUpViewModel(auth)
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun fill(
        name: String = " Ada Lovelace ",
        email: String = " ada@example.com ",
        password: String = "password-1",
        confirm: String = password,
        invite: String = "",
    ) {
        viewModel.onNameChange(name)
        viewModel.onEmailChange(email)
        viewModel.onPasswordChange(password)
        viewModel.onPasswordConfirmChange(confirm)
        viewModel.onInviteCodeChange(invite)
    }

    private fun refusedLocally(expected: SignUpError) {
        viewModel.submit()
        assertEquals(expected, viewModel.state.error)
        assertTrue(auth.signUps.isEmpty())
    }

    @Test fun `every field but the invite is required`() {
        fill(name = " ")
        assertFalse(viewModel.state.canSubmit)
        fill(confirm = "")
        assertFalse(viewModel.state.canSubmit)
        fill()
        assertTrue(viewModel.state.canSubmit)
    }

    @Test fun `the form's rules are checked before sending`() {
        fill(name = "x".repeat(101))
        refusedLocally(SignUpError.NameTooLong)
        fill(email = "ada@example")
        refusedLocally(SignUpError.InvalidEmail)
        fill(password = "short")
        refusedLocally(SignUpError.PasswordTooShort)
        fill(confirm = "password-2")
        refusedLocally(SignUpError.PasswordsMismatch)
    }

    @Test fun `sends trimmed values, then shows the check-your-email state`() {
        fill(invite = " CODE ")
        viewModel.submit()
        assertTrue(viewModel.state.submitting)
        assertEquals(listOf(SignUpCall("Ada Lovelace", "ada@example.com", "password-1", " CODE ")), auth.signUps)
        auth.signUpResult.complete(ApiResult.Success(Unit))
        assertTrue(viewModel.state.created)
        assertFalse(viewModel.state.submitting)
        assertEquals("", viewModel.state.password)
        assertFalse(viewModel.state.canSubmit)
    }

    @Test fun `server errors land on their field and an edit clears them`() {
        fill(invite = "OLD")
        viewModel.submit()
        auth.signUpResult.complete(ApiResult.Failure(ApiError.Validation("expired", emptyList(), "INVITE_CODE_EXPIRED")))
        assertEquals(SignUpError.InviteExpired, viewModel.state.error)
        assertEquals(SignUpField.InviteCode, viewModel.state.error?.field)
        assertFalse(viewModel.state.submitting)
        viewModel.onInviteCodeChange("NEW")
        assertNull(viewModel.state.error)
    }

    @Test fun `maps each api error`() {
        fun map(error: ApiError) = error.toSignUpError()
        assertEquals(SignUpError.EmailTaken, map(ApiError.Unknown(422, "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", null)))
        assertEquals(SignUpError.PasswordTooShort, map(ApiError.Validation(null, emptyList(), "PASSWORD_TOO_SHORT")))
        assertEquals(SignUpError.InvalidEmail, map(ApiError.Validation(null, emptyList(), "INVALID_EMAIL")))
        assertEquals(SignUpError.InviteInvalid, map(ApiError.Validation(null, emptyList(), "INVITE_CODE_INVALID")))
        assertEquals(SignUpError.InviteUsedUp, map(ApiError.Validation(null, emptyList(), "INVITE_CODE_MAX_USES")))
        assertEquals(SignUpError.InviteExpired, map(ApiError.Validation(null, emptyList(), "INVITE_CODE_EXPIRED")))
        assertEquals(SignUpError.Offline, map(ApiError.Network(IOException())))
        assertEquals(SignUpError.Unexpected, map(ApiError.Server(500, null)))
        assertEquals(SignUpError.Unexpected, map(ApiError.Validation(null, emptyList(), "INVALID_NAME")))
    }
}
