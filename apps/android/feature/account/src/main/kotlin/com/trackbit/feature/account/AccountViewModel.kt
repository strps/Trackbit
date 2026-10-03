package com.trackbit.feature.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AccountRepository
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.auth.PreferencesRepository
import com.trackbit.core.model.AccountRules
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The password form's fields; [showProblems] once the user has tried to submit. */
data class PasswordForm(
    val current: String = "",
    val new: String = "",
    val confirm: String = "",
    val showProblems: Boolean = false,
) {
    val tooShort get() = new.length < AccountRules.PASSWORD_MIN
    val mismatch get() = new != confirm
    val valid get() = current.isNotEmpty() && !tooShort && !mismatch
}

enum class AccountMessage { ProfileUpdated, PasswordChanged, InvalidPassword, Offline, Failed }

data class AccountUiState(
    val user: SessionUser? = null,
    /** The name being edited; null while it is the stored one. */
    val name: String? = null,
    val password: PasswordForm = PasswordForm(),
    val savingName: Boolean = false,
    val changingPassword: Boolean = false,
    val message: AccountMessage? = null,
) {
    val shownName get() = name ?: user?.name.orEmpty()
    val nameValid get() = shownName.trim().length in AccountRules.NAME_LENGTH
    val canSaveName get() = name != null && name.trim() != user?.name && nameValid && !savingName
}

/**
 * The web's account settings: profile name, preferences and password. Preferences apply at once
 * (cached user, then a PATCH); the name and password need the server's answer.
 */
@HiltViewModel
class AccountViewModel @Inject constructor(
    private val auth: AuthRepository,
    private val account: AccountRepository,
    private val preferences: PreferencesRepository,
) : ViewModel() {
    private val form = MutableStateFlow(AccountUiState())

    val state: StateFlow<AccountUiState> = combine(auth.state, form, ::withUser)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), withUser(auth.state.value, form.value))

    private fun withUser(auth: AuthState, form: AccountUiState) = form.copy(user = (auth as? AuthState.SignedIn)?.user)

    fun editName(name: String) = form.update { it.copy(name = name) }

    fun saveName() {
        val current = withUser(auth.state.value, form.value)
        if (!current.canSaveName) return
        form.update { it.copy(savingName = true) }
        viewModelScope.launch {
            val result = account.updateName(current.shownName)
            form.update {
                when (result) {
                    is ApiResult.Success -> it.copy(savingName = false, name = null, message = AccountMessage.ProfileUpdated)
                    is ApiResult.Failure -> it.copy(savingName = false, message = result.error.toMessage())
                }
            }
        }
    }

    fun editPassword(change: (PasswordForm) -> PasswordForm) = form.update { it.copy(password = change(it.password)) }

    fun changePassword() {
        val password = form.value.password
        if (!password.valid) {
            editPassword { it.copy(showProblems = true) }
            return
        }
        if (form.value.changingPassword) return
        form.update { it.copy(changingPassword = true) }
        viewModelScope.launch {
            val result = account.changePassword(password.current, password.new)
            form.update {
                when (result) {
                    is ApiResult.Success -> it.copy(changingPassword = false, password = PasswordForm(), message = AccountMessage.PasswordChanged)
                    is ApiResult.Failure -> it.copy(changingPassword = false, message = result.error.toMessage())
                }
            }
        }
    }

    fun setLocale(locale: String) = launch { preferences.setLocale(locale) }

    fun setUnitSystem(unitSystem: UnitSystem) = launch { preferences.setUnitSystem(unitSystem) }

    fun setCardStyle(style: ExerciseLogCardStyle) = launch { preferences.setExerciseLogCardStyle(style) }

    /** 0 turns the rest timer off. */
    fun setDefaultRest(seconds: Int) = launch { preferences.setDefaultRestSeconds(seconds.coerceIn(SessionUser.REST_SECONDS_RANGE)) }

    /** Clears [shown] unless a newer message has replaced it. */
    fun onMessageShown(shown: AccountMessage) = form.update { if (it.message == shown) it.copy(message = null) else it }

    private fun launch(block: suspend () -> Unit) {
        viewModelScope.launch { block() }
    }
}

internal fun ApiError.toMessage(): AccountMessage = when {
    this is ApiError.Network -> AccountMessage.Offline
    this is ApiError.Validation && code == "INVALID_PASSWORD" -> AccountMessage.InvalidPassword
    else -> AccountMessage.Failed
}
