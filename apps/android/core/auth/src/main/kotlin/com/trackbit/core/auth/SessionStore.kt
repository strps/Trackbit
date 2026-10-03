package com.trackbit.core.auth

import androidx.datastore.core.DataStore
import com.trackbit.core.auth.di.AuthScope
import com.trackbit.core.model.SessionUser
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
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
import java.util.Locale
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

    /** The token a [rotate] is replacing: the server may already reject it, which is expected. */
    @Volatile private var rotating: String? = null

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
        if (rejectedToken == rotating) return
        scope.launch { clear(ifToken = rejectedToken) }
    }

    /**
     * The signed-in user's language, which is also the app's; the device's while signed out or
     * still loading. Memory only, like [currentToken].
     */
    fun language(): Locale = current?.user?.locale?.let(Locale::forLanguageTag) ?: Locale.getDefault()

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

    /** Replaces the cached user, if [ifToken] is still the session's. */
    suspend fun updateUser(ifToken: String, user: SessionUser) = updateUser(ifToken) { user }

    /** Changes the cached user, if [ifToken] is still the session's. */
    suspend fun updateUser(ifToken: String, change: (SessionUser) -> SessionUser) = locked {
        val session = current?.takeIf { it.token == ifToken } ?: return@locked
        val user = change(session.user)
        val updated = session.copy(user = user)
        dataStore.updateData { updated }
        current = updated
        _state.value = AuthState.SignedIn(user)
    }

    /**
     * Runs [call], which ends the session [ifToken] on the server and starts a new one, and adopts
     * the new token it returns (same user, so nothing else changes). Meanwhile, a 401 for the old
     * token is expected and doesn't sign out; a 401 for the call itself does.
     */
    suspend fun rotate(ifToken: String, call: suspend () -> ApiResult<String>): ApiResult<String> {
        rotating = ifToken
        try {
            val result = call()
            when (result) {
                is ApiResult.Success -> locked {
                    val session = current?.takeIf { it.token == ifToken } ?: return@locked
                    val updated = session.copy(token = result.value)
                    dataStore.updateData { updated }
                    current = updated
                }
                is ApiResult.Failure -> if (result.error is ApiError.Unauthorized) clear(ifToken)
            }
            return result
        } finally {
            rotating = null
        }
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
