package com.trackbit.core.auth

import com.trackbit.core.auth.di.AuthScope
import com.trackbit.core.model.PreferredExerciseSourceRequest
import com.trackbit.core.network.safeCall
import com.trackbit.core.network.service.MeService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The signed-in user's preferences, which live on the user row and come back with the session
 * ([AuthState.SignedIn]'s user). A change shows at once in the cached user, then goes to the
 * server; offline, the next session refresh brings the server's value back.
 */
interface PreferencesRepository {
    /** The session picker's source: a source key such as `list:12`, or null for browse mode. */
    suspend fun setPreferredExerciseSource(key: String?)
}

internal class DefaultPreferencesRepository @Inject constructor(
    private val store: SessionStore,
    private val meService: MeService,
    @AuthScope private val scope: CoroutineScope,
) : PreferencesRepository {
    override suspend fun setPreferredExerciseSource(key: String?) {
        val token = store.token() ?: return
        store.updateUser(ifToken = token) { it.copy(preferredExerciseSource = key) }
        // Outlives the caller (a screen being closed).
        scope.launch { safeCall { meService.updatePreferredExerciseSource(PreferredExerciseSourceRequest(key)) } }
    }
}
