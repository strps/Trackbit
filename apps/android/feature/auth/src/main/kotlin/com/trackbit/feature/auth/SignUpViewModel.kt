package com.trackbit.feature.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.model.AccountRules
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SignUpUiState(
    val name: String = "",
    val email: String = "",
    val password: String = "",
    val passwordConfirm: String = "",
    /** Optional, as on the web; an emailed invite grants its role. */
    val inviteCode: String = "",
    val submitting: Boolean = false,
    val error: SignUpError? = null,
    /** The account exists and its verification link is on the way; the form is done. */
    val created: Boolean = false,
) {
    val canSubmit: Boolean
        get() = !submitting && !created && name.isNotBlank() && email.isNotBlank() &&
            password.isNotEmpty() && passwordConfirm.isNotEmpty()
}

enum class SignUpError(val field: SignUpField?) {
    NameTooLong(SignUpField.Name),
    InvalidEmail(SignUpField.Email),
    EmailTaken(SignUpField.Email),
    PasswordTooShort(SignUpField.Password),
    PasswordsMismatch(SignUpField.PasswordConfirm),
    InviteInvalid(SignUpField.InviteCode),
    InviteUsedUp(SignUpField.InviteCode),
    InviteExpired(SignUpField.InviteCode),
    Offline(null),
    Unexpected(null),
}

enum class SignUpField { Name, Email, Password, PasswordConfirm, InviteCode }

/**
 * Creates an account. Like the web, it starts no session: the user opens the emailed link, then
 * signs in, so the app's routing ([AuthRepository.state]) doesn't change here.
 */
@HiltViewModel
class SignUpViewModel @Inject constructor(
    private val auth: AuthRepository,
) : ViewModel() {
    var state by mutableStateOf(SignUpUiState())
        private set

    fun onNameChange(value: String) = edit { copy(name = value) }
    fun onEmailChange(value: String) = edit { copy(email = value) }
    fun onPasswordChange(value: String) = edit { copy(password = value) }
    fun onPasswordConfirmChange(value: String) = edit { copy(passwordConfirm = value) }
    fun onInviteCodeChange(value: String) = edit { copy(inviteCode = value) }

    private inline fun edit(change: SignUpUiState.() -> SignUpUiState) {
        if (state.submitting || state.created) return
        state = state.change().copy(error = null)
    }

    fun submit() {
        if (!state.canSubmit) return
        val name = state.name.trim()
        val email = state.email.trim()
        val error = when {
            name.length > AccountRules.NAME_LENGTH.last -> SignUpError.NameTooLong
            !isEmail(email) -> SignUpError.InvalidEmail
            state.password.length < AccountRules.PASSWORD_MIN -> SignUpError.PasswordTooShort
            state.password != state.passwordConfirm -> SignUpError.PasswordsMismatch
            else -> null
        }
        if (error != null) {
            state = state.copy(error = error)
            return
        }
        state = state.copy(submitting = true, error = null)
        viewModelScope.launch {
            state = when (val result = auth.signUp(name, email, state.password, state.inviteCode)) {
                is ApiResult.Success -> state.copy(submitting = false, created = true, password = "", passwordConfirm = "")
                is ApiResult.Failure -> state.copy(submitting = false, error = result.error.toSignUpError())
            }
        }
    }
}

internal fun ApiError.toSignUpError(): SignUpError {
    val code = when (this) {
        is ApiError.Validation -> code
        is ApiError.Unknown -> code
        else -> null
    }
    return when {
        this is ApiError.Network -> SignUpError.Offline
        code == "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" -> SignUpError.EmailTaken
        code == "INVALID_EMAIL" -> SignUpError.InvalidEmail
        code == "PASSWORD_TOO_SHORT" -> SignUpError.PasswordTooShort
        code == "INVITE_CODE_INVALID" -> SignUpError.InviteInvalid
        code == "INVITE_CODE_MAX_USES" -> SignUpError.InviteUsedUp
        code == "INVITE_CODE_EXPIRED" -> SignUpError.InviteExpired
        else -> SignUpError.Unexpected
    }
}
