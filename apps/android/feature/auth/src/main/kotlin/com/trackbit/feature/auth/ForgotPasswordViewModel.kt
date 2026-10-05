package com.trackbit.feature.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ForgotPasswordUiState(
    val email: String = "",
    val submitting: Boolean = false,
    val error: ForgotPasswordError? = null,
    /** The link is on its way (or the account doesn't exist; the server doesn't say). */
    val sent: Boolean = false,
) {
    val canSubmit: Boolean get() = !submitting && email.isNotBlank()
}

enum class ForgotPasswordError { InvalidEmail, Offline, Unexpected }

/**
 * Asks for a reset link. The emailed link opens the web's reset page, where the new password is
 * set; every signed-in device then has to sign in again.
 */
@HiltViewModel
class ForgotPasswordViewModel @Inject constructor(
    private val auth: AuthRepository,
    savedState: SavedStateHandle,
) : ViewModel() {
    var state by mutableStateOf(ForgotPasswordUiState(email = savedState.get<String>(EMAIL).orEmpty()))
        private set

    fun onEmailChange(email: String) {
        if (state.submitting) return
        state = state.copy(email = email, error = null, sent = false)
    }

    fun submit() {
        if (!state.canSubmit) return
        val email = state.email.trim()
        if (!isEmail(email)) {
            state = state.copy(error = ForgotPasswordError.InvalidEmail)
            return
        }
        state = state.copy(submitting = true, error = null, sent = false)
        viewModelScope.launch {
            state = when (val result = auth.requestPasswordReset(email)) {
                is ApiResult.Success -> state.copy(submitting = false, sent = true)
                is ApiResult.Failure -> state.copy(
                    submitting = false,
                    error = if (result.error is ApiError.Network) ForgotPasswordError.Offline else ForgotPasswordError.Unexpected,
                )
            }
        }
    }

    companion object {
        /** The route's argument: the sign-in form's email, to start from. */
        const val EMAIL = "email"
    }
}
