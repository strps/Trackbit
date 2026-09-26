package com.trackbit.core.auth

import androidx.datastore.core.DataStore
import kotlinx.coroutines.CoroutineExceptionHandler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class SessionStoreTest {
    @get:Rule val folder = TemporaryFolder()

    private fun harness(aead: com.google.crypto.tink.Aead = testAead()) =
        StoreHarness(folder.root.resolve("session.enc"), aead)

    @Test fun `starts signed out and clears cached data when nothing is stored`() = runTest {
        harness().use { h ->
            assertEquals(AuthState.SignedOut, h.settled())
            assertNull(h.store.currentToken())
            assertEquals(1, h.signOuts.size)
        }
    }

    @Test fun `a saved session survives a restart without touching cached data`() = runTest {
        val aead = testAead()
        harness(aead).use { h ->
            h.settled()
            h.store.save(StoredSession("tok", user()))
        }
        harness(aead).use { h ->
            assertEquals(AuthState.SignedIn(user()), h.settled())
            assertEquals("tok", h.store.currentToken())
            assertEquals(0, h.signOuts.size)
        }
    }

    @Test fun `a session that no longer decrypts is signed out`() = runTest {
        harness().use { h ->
            h.settled()
            h.store.save(StoredSession("tok", user()))
        }
        harness(aead = testAead()).use { h ->
            assertEquals(AuthState.SignedOut, h.settled())
            assertEquals(1, h.signOuts.size)
        }
    }

    @Test fun `currentToken waits for the stored session instead of answering null`() = runTest {
        val aead = testAead()
        harness(aead).use { h ->
            h.settled()
            h.store.save(StoredSession("tok", user()))
        }
        harness(aead).use { h -> assertEquals("tok", h.store.currentToken()) }
    }

    @Test fun `a 401 for the current token signs out`() = runTest {
        harness().use { h ->
            h.settled()
            h.store.save(StoredSession("tok", user()))
            h.store.onUnauthorized("tok")
            assertEquals(AuthState.SignedOut, h.store.state.first { it == AuthState.SignedOut })
            assertNull(h.store.currentToken())
            assertNull(h.dataStore.data.first())
            assertEquals(2, h.signOuts.size) // startup + the 401
        }
    }

    @Test fun `a 401 for an older token does not undo a newer sign-in`() = runTest {
        harness().use { h ->
            h.settled()
            h.store.save(StoredSession("new", user()))
            h.store.clear(ifToken = "old")
            assertEquals("new", h.store.currentToken())
            assertEquals(AuthState.SignedIn(user()), h.store.state.value)
        }
    }

    @Test fun `signing in as another user clears the previous user's data`() = runTest {
        harness().use { h ->
            h.settled()
            h.store.save(StoredSession("a", user(id = "u_1")))
            h.store.save(StoredSession("a2", user(id = "u_1")))
            assertEquals(1, h.signOuts.size) // only the startup one
            h.store.save(StoredSession("b", user(id = "u_2")))
            assertEquals(2, h.signOuts.size)
        }
    }

    @Test fun `updateUser ignores a response for a replaced session`() = runTest {
        harness().use { h ->
            h.settled()
            h.store.save(StoredSession("new", user(name = "cj")))
            h.store.updateUser(ifToken = "old", user = user(name = "stale"))
            assertEquals(AuthState.SignedIn(user(name = "cj")), h.store.state.value)
            h.store.updateUser(ifToken = "new", user = user(name = "fresh"))
            assertEquals(AuthState.SignedIn(user(name = "fresh")), h.store.state.value)
            assertEquals("fresh", h.dataStore.data.first()!!.user.name)
        }
    }

    @Test(timeout = 10_000)
    fun `a session read that fails unexpectedly fails currentToken instead of blocking it`() {
        val broken = object : DataStore<StoredSession?> {
            override val data: Flow<StoredSession?> = flow { throw IllegalStateException("broken") }
            override suspend fun updateData(transform: suspend (t: StoredSession?) -> StoredSession?) = error("unused")
        }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO + CoroutineExceptionHandler { _, _ -> })
        val store = SessionStore(broken, emptySet(), scope)
        try {
            store.currentToken()
            throw AssertionError("expected the load failure")
        } catch (e: IllegalStateException) {
            assertEquals("broken", e.message)
        } finally {
            scope.cancel()
        }
    }
}
