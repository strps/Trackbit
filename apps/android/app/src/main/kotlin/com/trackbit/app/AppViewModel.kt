package com.trackbit.app

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The session for the whole UI. Routing follows [authState]; nothing navigates on sign-in/out. */
@HiltViewModel
class AppViewModel @Inject constructor(
    private val auth: AuthRepository,
) : ViewModel() {
    val authState: StateFlow<AuthState> get() = auth.state

    /** The signed-in user's locale, which the app's language follows ([AppLanguage]). */
    val locale: Flow<String> = auth.state.filterIsInstance<AuthState.SignedIn>().map { it.user.locale }.distinctUntilChanged()

    init {
        // Once per launch: picks up a session revoked elsewhere, or a changed user. Offline, the
        // cached session stays and the app opens on it.
        viewModelScope.launch { auth.refresh() }
    }

    fun signOut() {
        viewModelScope.launch { auth.signOut() }
    }
}
