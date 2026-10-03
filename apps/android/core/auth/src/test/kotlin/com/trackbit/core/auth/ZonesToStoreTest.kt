package com.trackbit.core.auth

import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ZonesToStoreTest {
    @Test fun `stores the device's zone whenever the signed-in user's differs`() = runTest {
        val device = MutableStateFlow("America/Costa_Rica")
        val auth = MutableStateFlow<AuthState>(AuthState.Loading)
        val sent = mutableListOf<String>()
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { zonesToStore(device, auth).collect { sent += it } }

        auth.value = AuthState.SignedIn(user()) // already the device's (America/Costa_Rica)
        device.value = "Europe/Madrid" // travelled
        assertEquals(listOf("Europe/Madrid"), sent)

        auth.value = AuthState.SignedIn(user().copy(timezone = "Europe/Madrid")) // the PATCH, cached
        auth.value = AuthState.SignedIn(user()) // a refresh brought the old one back (offline PATCH)
        assertEquals(listOf("Europe/Madrid", "Europe/Madrid"), sent)

        auth.value = AuthState.SignedOut
        device.value = "Asia/Tokyo"
        assertEquals(2, sent.size)
    }
}
