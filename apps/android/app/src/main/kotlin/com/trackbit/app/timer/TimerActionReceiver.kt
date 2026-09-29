package com.trackbit.app.timer

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.trackbit.core.data.TrackerRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * The timer notification's Stop and +30s buttons. They change Room only; [TimerNotifier] and the
 * widgets follow from there.
 */
class TimerActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val tracker = EntryPointAccessors.fromApplication<TimerEntryPoint>(context.applicationContext).tracker()
        val habitId = intent.getIntExtra(EXTRA_HABIT_ID, -1).takeIf { it >= 0 } ?: return
        val action = intent.action
        val pending = goAsync()
        CoroutineScope(Dispatchers.Default).launch {
            try {
                when (action) {
                    ACTION_STOP -> tracker.stopTimer(habitId)
                    ACTION_ADD_30S -> tracker.addToTimer(habitId, 30_000)
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
    }

    companion object {
        private const val ACTION_STOP = "com.trackbit.app.timer.STOP"
        private const val ACTION_ADD_30S = "com.trackbit.app.timer.ADD_30S"
        private const val EXTRA_HABIT_ID = "habitId"

        fun stop(context: Context, habitId: Int) = pendingIntent(context, ACTION_STOP, habitId)

        fun add30s(context: Context, habitId: Int) = pendingIntent(context, ACTION_ADD_30S, habitId)

        // The action and the request code (the habit) keep each button's intent distinct.
        private fun pendingIntent(context: Context, action: String, habitId: Int): PendingIntent = PendingIntent.getBroadcast(
            context,
            habitId,
            Intent(context, TimerActionReceiver::class.java).setAction(action).putExtra(EXTRA_HABIT_ID, habitId),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
    }
}
