package com.trackbit.widget

import com.trackbit.core.auth.AuthState
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

class WidgetRefreshesTest {
    @Test fun `data changes and session changes re-render, startup loading and repeats don't`() = runTest {
        val changes = MutableSharedFlow<Unit>()
        val auth = MutableStateFlow<AuthState>(AuthState.Loading)
        var refreshes = 0
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) {
            widgetRefreshes(changes, auth).collect { refreshes++ }
        }
        assertEquals(0, refreshes)

        auth.value = AuthState.SignedIn(user())
        assertEquals("the first known state", 1, refreshes)

        changes.emit(Unit)
        assertEquals(2, refreshes)

        auth.value = AuthState.SignedIn(user())
        assertEquals("the same session", 2, refreshes)

        auth.value = AuthState.SignedOut
        assertEquals(3, refreshes)

        auth.value = AuthState.SignedIn(user("u_2"))
        assertEquals(4, refreshes)
    }
}
