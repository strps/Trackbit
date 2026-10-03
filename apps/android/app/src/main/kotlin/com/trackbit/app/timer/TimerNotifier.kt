package com.trackbit.app.timer

import android.Manifest
import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.ui.graphics.toArgb
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.trackbit.app.MainActivity
import com.trackbit.core.data.RestTimer
import com.trackbit.core.data.RestTimerRepository
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.designsystem.color.colorAt
import com.trackbit.core.designsystem.format.formatDuration
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.designsystem.icon.drawableRes
import com.trackbit.core.i18n.R as I18nR
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import java.time.Clock
import javax.inject.Inject
import javax.inject.Singleton

/**
 * One ongoing notification per running timer, kept in step with Room: whatever starts or stops a
 * timer (a widget, the app, the notification itself, a habit deleted by a sync, sign-out clearing
 * the database), this posts or cancels to match. Call [start] once, from `Application.onCreate`;
 * a new process re-posts the timers that are still running. The rest timer gets one too,
 * counting down; when it ends, [RestAlarm] has [alertRestOver] post a separate alert.
 *
 * No foreground service: a timer is a stored start instant, and the notification's chronometer
 * ticks in the system UI, so nothing has to keep running meanwhile.
 */
@Singleton
class TimerNotifier @Inject internal constructor(
    @ApplicationContext private val context: Context,
    private val tracker: TrackerRepository,
    private val restTimers: RestTimerRepository,
    private val clock: Clock,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val manager = NotificationManagerCompat.from(context)

    /** The last timers seen, to post them once notifications are allowed. */
    @Volatile private var running: Running = Running(emptyList(), null)

    fun start() {
        manager.createNotificationChannelsCompat(
            listOf(
                NotificationChannelCompat.Builder(CHANNEL, NotificationManagerCompat.IMPORTANCE_LOW)
                    .setName(context.getString(I18nR.string.android_timer_channel_name))
                    .setDescription(context.getString(I18nR.string.android_timer_channel_description))
                    .setShowBadge(false)
                    .build(),
                // High: a heads-up with the default sound and vibration, even with the app open.
                NotificationChannelCompat.Builder(REST_ALERT_CHANNEL, NotificationManagerCompat.IMPORTANCE_HIGH)
                    .setName(context.getString(I18nR.string.android_rest_alert_channel_name))
                    .setDescription(context.getString(I18nR.string.android_rest_alert_channel_description))
                    .setVibrationEnabled(true)
                    .setShowBadge(false)
                    .build(),
            ),
        )
        scope.launch {
            combine(tracker.observeRunningTimers(), restTimers.observe(), ::Running).distinctUntilChanged().collect(::show)
        }
    }

    /** Posts the running timers after the user allows notifications. */
    fun onPermissionGranted() {
        scope.launch { show(running) }
    }

    /** The rest timer just ended: sound, vibrate and say so. Its countdown is gone by then. */
    fun alertRestOver() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        val alert = NotificationCompat.Builder(context, REST_ALERT_CHANNEL)
            .setSmallIcon(UiIcons.Timer)
            .setContentTitle(context.getString(I18nR.string.android_rest_over_title))
            .setContentText(context.getString(I18nR.string.android_rest_over_text))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setTimeoutAfter(REST_ALERT_TIMEOUT_MS)
            .setContentIntent(openApp())
            .build()
        manager.notify(REST_ALERT_TAG, REST_ID, alert)
    }

    private fun show(timers: Running) {
        running = timers
        val ids = timers.habits.map { it.id }.toSet()
        context.getSystemService(NotificationManager::class.java).activeNotifications
            .filter { it.tag == TAG && it.id !in ids }
            .forEach { manager.cancel(TAG, it.id) }
        // A rest that is over (its alarm not yet run) shows nothing; a new one replaces the last alert.
        val rest = timers.rest?.takeUnless { it.isOver(clock.instant()) }
        if (rest == null) manager.cancel(REST_TAG, REST_ID) else manager.cancel(REST_ALERT_TAG, REST_ID)
        // Without the permission (13+) timers still run; they show in the widgets only.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        timers.habits.forEach { manager.notify(TAG, it.id, notification(it)) }
        rest?.let { manager.notify(REST_TAG, REST_ID, restNotification(it)) }
    }

    /** Counts down to the rest's end, and goes away then: the alert takes over. */
    private fun restNotification(rest: RestTimer): Notification = NotificationCompat.Builder(context, CHANNEL)
        .setSmallIcon(UiIcons.Timer)
        .setContentTitle(context.getString(I18nR.string.android_rest_title))
        .setWhen(rest.endsAt.toEpochMilli())
        .setShowWhen(true)
        .setUsesChronometer(true)
        .setChronometerCountDown(true)
        .setTimeoutAfter(rest.remainingMs(clock.instant()))
        .setOngoing(true)
        .setSilent(true)
        .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(openApp())
        .addAction(0, context.getString(I18nR.string.android_rest_minus_15s), TimerActionReceiver.adjustRest(context, -RestTimer.STEP_MS))
        .addAction(0, context.getString(I18nR.string.android_rest_plus_15s), TimerActionReceiver.adjustRest(context, RestTimer.STEP_MS))
        .addAction(0, context.getString(I18nR.string.android_rest_skip), TimerActionReceiver.skipRest(context))
        .build()

    /** Counts up from the moment the day's total was zero, so it shows the day's time. */
    private fun notification(habit: TrackedHabit): Notification = NotificationCompat.Builder(context, CHANNEL)
        .setSmallIcon(habit.icon.drawableRes)
        .setColor(habit.colorStops.colorAt(1f).toArgb())
        .setContentTitle(habit.name)
        .setContentText(context.getString(I18nR.string.android_timer_goal, formatDuration(habit.progress.goal)))
        .setWhen(requireNotNull(habit.timerBase).toEpochMilli())
        .setShowWhen(true)
        .setUsesChronometer(true)
        .setOngoing(true)
        .setSilent(true)
        .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(openApp())
        .addAction(0, context.getString(I18nR.string.android_timer_stop), TimerActionReceiver.stop(context, habit.id))
        .addAction(0, context.getString(I18nR.string.android_timer_add_30s), TimerActionReceiver.add30s(context, habit.id))
        .build()

    private fun openApp(): PendingIntent = PendingIntent.getActivity(
        context,
        0,
        Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_IMMUTABLE,
    )

    private data class Running(val habits: List<TrackedHabit>, val rest: RestTimer?)

    private companion object {
        const val CHANNEL = "timers"
        const val REST_ALERT_CHANNEL = "rest_alerts"

        /** Notification ids are habit ids, under this tag so they can't clash with others. */
        const val TAG = "habit-timer"
        const val REST_TAG = "rest-timer"
        const val REST_ALERT_TAG = "rest-alert"
        const val REST_ID = 1

        /** The alert is for the moment the rest ends; later it is only clutter. */
        const val REST_ALERT_TIMEOUT_MS = 5 * 60_000L
    }
}
