package com.trackbit.app.timer

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import com.trackbit.core.data.RestEnd
import com.trackbit.core.data.RestTimer
import com.trackbit.core.data.RestTimerRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.Clock
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The rest timer's alarm, kept in step with Room like [TimerNotifier]: a rest started, moved or
 * ended anywhere sets or cancels it. It is set for the rest's end, where [RestAlarmReceiver] has
 * [TimerNotifier] alert, and then for its expiry, where the receiver removes it. Call [start]
 * once, from `Application.onCreate`; a new process (after a reboot, which drops alarms) sets it
 * again, and a rest already over then gets no alert.
 *
 * Exact when the user allows exact alarms (`SCHEDULE_EXACT_ALARM`; asked from the session
 * screen), else inexact, which can be about a minute late.
 */
@Singleton
class RestAlarm @Inject internal constructor(
    @ApplicationContext private val context: Context,
    private val restTimers: RestTimerRepository,
    private val clock: Clock,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val alarms = context.getSystemService(AlarmManager::class.java)

    fun start() {
        scope.launch {
            restTimers.observe().distinctUntilChanged().collect(::set)
        }
    }

    /** Sets the alarm again for the current rest: exact alarms were just allowed, or it fired. */
    suspend fun reschedule() = set(restTimers.observe().first())

    private fun set(rest: RestTimer?) {
        val intent = alarmIntent()
        if (rest == null) {
            alarms.cancel(intent)
            return
        }
        // Once it is over, the next thing due is its expiry. A time already past fires at once.
        val at = (if (rest.isOver(clock.instant())) rest.expiresAt else rest.endsAt).toEpochMilli()
        if (canScheduleExact(alarms)) {
            alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent)
        } else {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent)
        }
    }

    private fun alarmIntent(): PendingIntent = PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, RestAlarmReceiver::class.java).setAction(RestAlarmReceiver.ACTION_REST_OVER),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
}

/** Exact alarms need no grant before Android 12; on 14+ they start denied. */
fun canScheduleExact(alarms: AlarmManager): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()

/** The rest's end alarm, and the system saying exact alarms were allowed. */
class RestAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val entryPoint = EntryPointAccessors.fromApplication<RestAlarmEntryPoint>(context.applicationContext)
        val action = intent.action
        val pending = goAsync()
        CoroutineScope(Dispatchers.Default).launch {
            try {
                when (action) {
                    ACTION_REST_OVER -> when (entryPoint.restTimers().onAlarm()) {
                        RestEnd.Ended -> {
                            entryPoint.notifier().showRestOver(alert = true)
                            entryPoint.restAlarm().reschedule()
                        }
                        RestEnd.Stale -> {
                            entryPoint.notifier().showRestOver(alert = false)
                            entryPoint.restAlarm().reschedule()
                        }
                        RestEnd.NotDue -> entryPoint.restAlarm().reschedule()
                        RestEnd.Expired, RestEnd.None -> Unit
                    }
                    ACTION_EXACT_ALARMS_ALLOWED -> entryPoint.restAlarm().reschedule()
                }
            } finally {
                pending.finish()
            }
        }
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface RestAlarmEntryPoint {
        fun restTimers(): RestTimerRepository
        fun restAlarm(): RestAlarm
        fun notifier(): TimerNotifier
    }

    internal companion object {
        const val ACTION_REST_OVER = "com.trackbit.app.timer.REST_OVER"

        /** `AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED`, sent on 12+ only. */
        const val ACTION_EXACT_ALARMS_ALLOWED = "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED"
    }
}
