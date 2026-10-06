package com.trackbit.app.timer

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.trackbit.core.data.RestTimerRepository
import com.trackbit.core.data.TrackerRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * The timer notifications' buttons: a habit timer's Stop and +30s, the rest timer's −15s, +15s
 * and Skip. They change Room only; [TimerNotifier], [RestAlarm] and the widgets follow from there.
 */
class TimerActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val entryPoint = EntryPointAccessors.fromApplication<TimerEntryPoint>(context.applicationContext)
        val habitUuid = intent.data?.schemeSpecificPart
        val action = intent.action
        val pending = goAsync()
        CoroutineScope(Dispatchers.Default).launch {
            try {
                when (action) {
                    ACTION_STOP -> if (habitUuid != null) entryPoint.tracker().stopTimer(habitUuid)
                    ACTION_ADD_30S -> if (habitUuid != null) entryPoint.tracker().addToTimer(habitUuid, 30_000)
                    ACTION_ADJUST_REST -> entryPoint.restTimers().adjust(intent.getLongExtra(EXTRA_MS, 0))
                    ACTION_SKIP_REST -> entryPoint.restTimers().skip()
                }
            } finally {
                pending.finish()
            }
        }
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface TimerEntryPoint {
        fun tracker(): TrackerRepository
        fun restTimers(): RestTimerRepository
    }

    companion object {
        private const val ACTION_STOP = "com.trackbit.app.timer.STOP"
        private const val ACTION_ADD_30S = "com.trackbit.app.timer.ADD_30S"
        private const val ACTION_ADJUST_REST = "com.trackbit.app.timer.ADJUST_REST"
        private const val ACTION_SKIP_REST = "com.trackbit.app.timer.SKIP_REST"
        /** A habit's buttons carry its uuid as their data, `habit:<uuid>`. */
        private const val HABIT_SCHEME = "habit"
        private const val EXTRA_MS = "ms"

        fun stop(context: Context, habitUuid: String) = pendingIntent(context, ACTION_STOP, habitUuid)

        fun add30s(context: Context, habitUuid: String) = pendingIntent(context, ACTION_ADD_30S, habitUuid)

        /** The request code tells −15s from +15s (the extras alone don't make intents distinct). */
        fun adjustRest(context: Context, ms: Long): PendingIntent = PendingIntent.getBroadcast(
            context,
            if (ms < 0) 0 else 1,
            Intent(context, TimerActionReceiver::class.java).setAction(ACTION_ADJUST_REST).putExtra(EXTRA_MS, ms),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        fun skipRest(context: Context): PendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, TimerActionReceiver::class.java).setAction(ACTION_SKIP_REST),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        // The action and the data (the habit) keep each button's intent distinct; extras wouldn't.
        private fun pendingIntent(context: Context, action: String, habitUuid: String): PendingIntent = PendingIntent.getBroadcast(
            context,
            0,
            Intent(context, TimerActionReceiver::class.java).setAction(action).setData(Uri.fromParts(HABIT_SCHEME, habitUuid, null)),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }
}
