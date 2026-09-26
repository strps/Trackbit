package com.trackbit.core.auth

import com.trackbit.core.model.SessionUser

sealed interface AuthState {
    /** The stored session hasn't been read yet. Lasts only until startup has decrypted it. */
    data object Loading : AuthState

    /** No session. The previous user's cached data is already gone (see [SignOutHook]). */
    data object SignedOut : AuthState

    /** [user] is the cached copy, so it is available offline; [AuthRepository.refresh] updates it. */
    data class SignedIn(val user: SessionUser) : AuthState
}
