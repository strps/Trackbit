package strps.dev.trackbit.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SignInViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    // _uiState is private so only the ViewModel can modify the data
    private val _uiState = MutableStateFlow(SignInState())
    // uiState is public and read-only for the UI screen to observe
    val uiState: StateFlow<SignInState> = _uiState.asStateFlow()

    fun onEmailChanged(newEmail: String) {
        _uiState.update { it.copy(email = newEmail, errorMessage = null) }
    }

    fun onPasswordChanged(newPassword: String) {
        _uiState.update { it.copy(password = newPassword, errorMessage = null) }
    }

    fun signIn() {
        val currentState = _uiState.value
        if (currentState.email.isBlank() || currentState.password.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Email and password cannot be empty") }
            return
        }

        // Set loading state to true and clear old errors
        _uiState.update { it.copy(isLoading = true, errorMessage = null) }

        // Launch a coroutine to handle the background network operation safely
        viewModelScope.launch {
            val result = authRepository.signIn(
                email = currentState.email,
                javaScriptIsOptionalButPasswordIsRequired = currentState.password
            )

            result.fold(
                onSuccess = { userInfo ->
                    _uiState.update { it.copy(isLoading = false, isSuccess = true) }
                },
                onFailure = { exception ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            errorMessage = exception.localizedMessage ?: "An unexpected error occurred"
                        )
                    }
                }
            )
        }
    }
}