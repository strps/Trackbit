package com.trackbit.feature.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SignInUiState(
    val email: String = "",
    val password: String = "",
    val submitting: Boolean = false,
    val error: SignInError? = null,
) {
    val canSubmit: Boolean get() = !submitting && email.isNotBlank() && password.isNotEmpty()
}

enum class SignInError { InvalidEmail, InvalidCredentials, EmailNotVerified, Offline, Unexpected }

/** Signing in only changes [AuthRepository.state]; the app routes away from here when it does. */
@HiltViewModel
class SignInViewModel @Inject constructor(
    private val auth: AuthRepository,
) : ViewModel() {
    var state by mutableStateOf(SignInUiState())
        private set

    fun onEmailChange(email: String) {
        state = state.copy(email = email, error = null)
    }

    fun onPasswordChange(password: String) {
        state = state.copy(password = password, error = null)
    }

    fun submit() {
        if (!state.canSubmit) return
        val email = state.email.trim()
        if (!EMAIL.matches(email)) {
            state = state.copy(error = SignInError.InvalidEmail)
            return
        }
        state = state.copy(submitting = true, error = null)
        viewModelScope.launch {
            when (val result = auth.signIn(email, state.password)) {
                // Stay "submitting" until the app navigates away, so the form can't be sent twice.
                is ApiResult.Success -> Unit
                is ApiResult.Failure -> state = state.copy(submitting = false, error = result.error.toSignInError())
            }
        }
    }

    private companion object {
        /** Same shape the server accepts; the server stays authoritative. */
        val EMAIL = Regex("""^[^\s@]+@[^\s@]+\.[^\s@]+$""")
    }
}

internal fun ApiError.toSignInError(): SignInError = when {
    this is ApiError.Unauthorized -> SignInError.InvalidCredentials
    this is ApiError.Unknown && code == "EMAIL_NOT_VERIFIED" -> SignInError.EmailNotVerified
    this is ApiError.Network -> SignInError.Offline
    else -> SignInError.Unexpected
}
