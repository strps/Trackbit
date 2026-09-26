package com.trackbit.feature.tracker

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import androidx.core.content.ContextCompat
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import java.time.LocalDate
import javax.inject.Inject

/** The device's current local day, re-emitted when it changes while someone is collecting. */
interface DayClock {
    val today: Flow<LocalDate>
}

/**
 * Re-reads the day on every minute tick and on clock or timezone changes, so the day rolls
 * over at midnight and after travel. Delivered only to a running process, which is all a screen
 * needs; each new collector starts from the current day.
 */
internal class SystemDayClock @Inject constructor(
    @ApplicationContext private val context: Context,
) : DayClock {
    override val today: Flow<LocalDate> = callbackFlow {
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                trySend(LocalDate.now())
            }
        }
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_TIME_TICK)
            addAction(Intent.ACTION_TIME_CHANGED)
            addAction(Intent.ACTION_TIMEZONE_CHANGED)
            addAction(Intent.ACTION_DATE_CHANGED)
        }
        // System broadcasts still reach a non-exported receiver.
        ContextCompat.registerReceiver(context, receiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED)
        trySend(LocalDate.now())
        awaitClose { context.unregisterReceiver(receiver) }
    }.distinctUntilChanged()
}
