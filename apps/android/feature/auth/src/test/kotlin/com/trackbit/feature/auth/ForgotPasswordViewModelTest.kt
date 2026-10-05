package com.trackbit.feature.auth

import androidx.lifecycle.SavedStateHandle
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class ForgotPasswordViewModelTest {
    private val auth = FakeAuthRepository()

    @Before fun setUp() = Dispatchers.setMain(UnconfinedTestDispatcher())

    @After fun tearDown() = Dispatchers.resetMain()

    private fun viewModel(email: String? = null) =
        ForgotPasswordViewModel(auth, SavedStateHandle(listOfNotNull(email?.let { ForgotPasswordViewModel.EMAIL to it }).toMap()))

    @Test fun `starts from the sign-in form's email`() {
        assertEquals("ada@example.com", viewModel("ada@example.com").state.email)
        assertEquals("", viewModel().state.email)
    }

    @Test fun `a malformed email is refused locally`() {
        val vm = viewModel("ada@")
        vm.submit()
        assertEquals(ForgotPasswordError.InvalidEmail, vm.state.error)
        assertTrue(auth.resets.isEmpty())
    }

    @Test fun `sends the trimmed email and confirms`() {
        val vm = viewModel(" ada@example.com ")
        vm.submit()
        assertTrue(vm.state.submitting)
        auth.resetResult.complete(ApiResult.Success(Unit))
        assertEquals(listOf("ada@example.com"), auth.resets)
        assertTrue(vm.state.sent)
        assertFalse(vm.state.submitting)
        vm.onEmailChange("other@example.com")
        assertFalse(vm.state.sent)
    }

    @Test fun `offline says so`() {
        val vm = viewModel("ada@example.com")
        vm.submit()
        auth.resetResult.complete(ApiResult.Failure(ApiError.Network(IOException())))
        assertEquals(ForgotPasswordError.Offline, vm.state.error)
        assertFalse(vm.state.sent)
    }
}
