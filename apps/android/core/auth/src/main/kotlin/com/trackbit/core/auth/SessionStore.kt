package com.trackbit.core.auth

import androidx.datastore.core.DataStore
import com.trackbit.core.auth.di.AuthScope
import com.trackbit.core.model.SessionUser
import com.trackbit.core.network.SessionTokenSource
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The session on disk and its decrypted copy in memory. Every change goes through here, one at
 * a time, so the token, [state] and the other stores ([SignOutHook]) never disagree.
 *
 * Changes that follow a network call take the token they started with and do nothing if the
 * session has changed since, so a stale response can't undo a newer sign-in or sign-out.
 */
@Singleton
internal class SessionStore @Inject constructor(
    private val dataStore: DataStore<StoredSession?>,
    private val signOutHooks: Set<@JvmSuppressWildcards SignOutHook>,
    @AuthScope private val scope: CoroutineScope,
) : SessionTokenSource {
    private val mutex = Mutex()
    private val loaded = CompletableDeferred<Unit>()

    @Volatile private var current: StoredSession? = null

    private val _state = MutableStateFlow<AuthState>(AuthState.Loading)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    init {
        scope.launch { load() }
    }

    /** Waits for the one read at startup, which only happens once; after that it is memory only. */
    override fun currentToken(): String? {
        // A failed read also counts as completed (and cancelled); awaiting rethrows it, so a
        // broken store never reads as "signed out".
        if (!loaded.isCompleted || loaded.isCancelled) runBlocking { loaded.await() }
        return current?.token
    }

    override fun onUnauthorized(rejectedToken: String) {
        scope.launch { clear(ifToken = rejectedToken) }
    }

    suspend fun token(): String? {
        loaded.await()
        return current?.token
    }

    /** Signs in. Signing in as someone else first clears the previous user's data. */
    suspend fun save(session: StoredSession) = locked {
        val previous = current
        if (previous != null && previous.user.id != session.user.id) runSignOutHooks()
        dataStore.updateData { session }
        current = session
        _state.value = AuthState.SignedIn(session.user)
    }

    /** Replaces the cached user, if [token] is still the session's. */
    suspend fun updateUser(ifToken: String, user: SessionUser) = locked {
        val session = current?.takeIf { it.token == ifToken } ?: return@locked
        val updated = session.copy(user = user)
        dataStore.updateData { updated }
        current = updated
        _state.value = AuthState.SignedIn(user)
    }

    /** Signs out, if [ifToken] is still the session's. */
    suspend fun clear(ifToken: String) = locked {
        if (current?.token != ifToken) return@locked
        // Forget the token first: if the process dies before the hooks finish, the next start
        // finds no session and runs them then.
        dataStore.updateData { null }
        current = null
        runSignOutHooks()
        _state.value = AuthState.SignedOut
    }

    private suspend fun load() {
        mutex.withLock {
            val stored = try {
                dataStore.data.first()
            } catch (_: IOException) {
                null // Unreadable (not undecryptable: that is handled as corruption). Keep the file.
            } catch (e: Throwable) {
                // Anything else is a bug. Fail every waiter instead of blocking them forever.
                loaded.completeExceptionally(e)
                throw e
            }
            current = stored
            loaded.complete(Unit)
            if (stored == null) {
                // "Signed out" always means "no cached data", even after a crash or a lost key.
                runSignOutHooks()
                _state.value = AuthState.SignedOut
            } else {
                _state.value = AuthState.SignedIn(stored.user)
            }
        }
    }

    private suspend fun runSignOutHooks() = signOutHooks.forEach { it.onSignedOut() }

    private suspend inline fun locked(crossinline block: suspend () -> Unit) {
        loaded.await()
        mutex.withLock { block() }
    }
}
