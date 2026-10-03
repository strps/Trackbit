package com.trackbit.core.data

import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.sync.localeChanges
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.toList
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class LocaleChangesTest {
    private val user = (FakeAuth().state.value as AuthState.SignedIn).user

    @Test fun `only a change of the same user's locale counts`() = runTest {
        val states = flowOf(
            AuthState.Loading,
            AuthState.SignedIn(user), // startup: nothing
            AuthState.SignedIn(user.copy(name = "renamed")), // another field: nothing
            AuthState.SignedIn(user.copy(locale = "es")), // 1
            AuthState.SignedOut,
            AuthState.SignedIn(user.copy(id = "u_2", locale = "en")), // someone else signs in: nothing
            AuthState.SignedIn(user.copy(id = "u_2", locale = "es")), // 2
        )
        assertEquals(2, localeChanges(states).toList().size)
    }
}
