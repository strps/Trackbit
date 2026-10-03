package com.trackbit.core.auth

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import com.trackbit.core.auth.di.AuthScope
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.time.ZoneId
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Keeps the user's stored timezone (the server's "today" for them) the device's zone (user,
 * E2): at startup, at sign-in, and whenever the zone changes while the process runs. A session
 * refresh that brings back another zone (the PATCH failed offline) is corrected the same way.
 */
@Singleton
class DeviceTimeZoneSync @Inject internal constructor(
    @ApplicationContext private val context: Context,
    private val store: SessionStore,
    private val preferences: PreferencesRepository,
    @AuthScope private val scope: CoroutineScope,
) {
    fun start() {
        scope.launch { zonesToStore(deviceZone(), store.state).collect { preferences.setTimezone(it) } }
    }

    private fun deviceZone(): Flow<String> = callbackFlow {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                trySend(ZoneId.systemDefault().id)
            }
        }
        // System broadcasts still reach a non-exported receiver.
        ContextCompat.registerReceiver(
            context, receiver, IntentFilter(Intent.ACTION_TIMEZONE_CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        trySend(ZoneId.systemDefault().id)
        awaitClose { context.unregisterReceiver(receiver) }
    }.distinctUntilChanged()
}

/** The device's zone whenever a signed-in user's stored one differs from it. */
internal fun zonesToStore(device: Flow<String>, auth: Flow<AuthState>): Flow<String> =
    combine(device, auth.map { (it as? AuthState.SignedIn)?.user?.timezone }) { zone, stored ->
        zone.takeIf { stored != null && stored != zone }
    }
        .distinctUntilChanged()
        .filterNotNull()
