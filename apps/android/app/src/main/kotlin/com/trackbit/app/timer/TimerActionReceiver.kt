package com.trackbit.app.timer

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
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
        val habitId = intent.getIntExtra(EXTRA_HABIT_ID, -1)
        val action = intent.action
        val pending = goAsync()
        CoroutineScope(Dispatchers.Default).launch {
            try {
                when (action) {
                    ACTION_STOP -> if (habitId >= 0) entryPoint.tracker().stopTimer(habitId)
                    ACTION_ADD_30S -> if (habitId >= 0) entryPoint.tracker().addToTimer(habitId, 30_000)
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
        private const val EXTRA_HABIT_ID = "habitId"
        private const val EXTRA_MS = "ms"

        fun stop(context: Context, habitId: Int) = pendingIntent(context, ACTION_STOP, habitId)

        fun add30s(context: Context, habitId: Int) = pendingIntent(context, ACTION_ADD_30S, habitId)

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

        // The action and the request code (the habit) keep each button's intent distinct.
        private fun pendingIntent(context: Context, action: String, habitId: Int): PendingIntent = PendingIntent.getBroadcast(
            context,
            habitId,
            Intent(context, TimerActionReceiver::class.java).setAction(action).putExtra(EXTRA_HABIT_ID, habitId),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }
}
