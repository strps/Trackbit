package com.trackbit.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The session for the whole UI. Routing follows [authState]; nothing navigates on sign-in/out. */
@HiltViewModel
class AppViewModel @Inject constructor(
    private val auth: AuthRepository,
) : ViewModel() {
    val authState: StateFlow<AuthState> get() = auth.state

    init {
        // Once per launch: picks up a session revoked elsewhere, or a changed user. Offline, the
        // cached session stays and the app opens on it.
        viewModelScope.launch { auth.refresh() }
    }

    fun signOut() {
        viewModelScope.launch { auth.signOut() }
    }
}
