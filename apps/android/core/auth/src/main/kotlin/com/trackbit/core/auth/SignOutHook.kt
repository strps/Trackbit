package com.trackbit.core.auth

/**
 * Deletes what belongs to the previous user once the session ends: sign-out, a 401, or no
 * session at startup. Bind implementations `@IntoSet`.
 *
 * Hooks finish before [AuthState.SignedOut] is emitted and before another sign-in can be saved,
 * so the next user never sees the previous user's data.
 */
fun interface SignOutHook {
    suspend fun onSignedOut()
}
