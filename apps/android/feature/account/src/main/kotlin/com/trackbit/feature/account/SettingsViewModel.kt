package com.trackbit.feature.account

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.model.SessionUser
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

/** The Settings tab: who is signed in. */
@HiltViewModel
class SettingsViewModel @Inject constructor(auth: AuthRepository) : ViewModel() {
    val user: StateFlow<SessionUser?> = auth.state
        .map { (it as? AuthState.SignedIn)?.user }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), (auth.state.value as? AuthState.SignedIn)?.user)
}
