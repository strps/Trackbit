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
import com.trackbit.core.designsystem.theme.TrackbitLightColors
import com.trackbit.core.i18n.R as I18nR
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.time.Clock
import java.time.Duration
import java.time.Instant
import javax.inject.Inject
import javax.inject.Singleton

/**
 * One ongoing notification per running timer, kept in step with Room: whatever starts or stops a
 * timer (a widget, the app, the notification itself, a habit deleted by a sync, sign-out clearing
 * the database), this posts or cancels to match. Call [start] once, from `Application.onCreate`;
 * a new process re-posts the timers that are still running. The rest timer gets one too,
 * counting down and then, in overtime, below zero; at its end, [RestAlarm] has [showRestOver]
 * post it again as the alert.
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

    /**
     * The rest timer just ended: its notification turns to overtime, and with [alert], sounds,
     * vibrates and pops up. Nothing in Room changes at the end, so [show] wouldn't repost it.
     */
    suspend fun showRestOver(alert: Boolean) {
        val now = clock.instant()
        val rest = restTimers.observe().first()?.takeIf { it.isOver(now) && !it.isExpired(now) } ?: return
        if (!canNotify()) return
        manager.notify(REST_TAG, REST_ID, restNotification(rest, now, alert))
    }

    private fun show(timers: Running) {
        running = timers
        val tags = timers.habits.mapTo(HashSet()) { habitTag(it.uuid) }
        context.getSystemService(NotificationManager::class.java).activeNotifications
            .filter { it.tag.orEmpty().startsWith(TAG_PREFIX) && it.tag !in tags }
            .forEach { manager.cancel(it.tag, it.id) }
        // An expired rest (its alarm not yet run) shows nothing. Reposting one in overtime is silent.
        val now = clock.instant()
        val rest = timers.rest?.takeUnless { it.isExpired(now) }
        if (rest == null) manager.cancel(REST_TAG, REST_ID)
        // Without the permission (13+) timers still run; they show in the widgets only.
        if (!canNotify()) return
        timers.habits.forEach { manager.notify(habitTag(it.uuid), HABIT_ID, notification(it)) }
        rest?.let { manager.notify(REST_TAG, REST_ID, restNotification(it, now, alert = false)) }
    }

    private fun canNotify(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    /**
     * Counts down to the rest's end and on below zero (the chronometer goes negative), until it
     * expires. In overtime it says so in red, with Done for the −/+ and Skip; with [alert] it is
     * on the alert channel, to sound and pop up.
     */
    private fun restNotification(rest: RestTimer, now: Instant, alert: Boolean): Notification {
        val builder = NotificationCompat.Builder(context, if (alert) REST_ALERT_CHANNEL else CHANNEL)
            .setSmallIcon(UiIcons.Timer)
            .setWhen(rest.endsAt.toEpochMilli())
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setTimeoutAfter(Duration.between(now, rest.expiresAt).toMillis())
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openApp())
        if (rest.isOver(now)) {
            builder
                .setContentTitle(context.getString(I18nR.string.android_rest_over_title))
                .setContentText(context.getString(I18nR.string.android_rest_over_text))
                .setColor(TrackbitLightColors.error.toArgb())
                .addAction(0, context.getString(I18nR.string.android_rest_done), TimerActionReceiver.skipRest(context))
        } else {
            builder
                .setContentTitle(context.getString(I18nR.string.android_rest_title))
                .addAction(0, context.getString(I18nR.string.android_rest_minus_15s), TimerActionReceiver.adjustRest(context, -RestTimer.STEP_MS))
                .addAction(0, context.getString(I18nR.string.android_rest_plus_15s), TimerActionReceiver.adjustRest(context, RestTimer.STEP_MS))
                .addAction(0, context.getString(I18nR.string.android_rest_skip), TimerActionReceiver.skipRest(context))
        }
        if (alert) {
            builder
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
        } else {
            builder.setCategory(NotificationCompat.CATEGORY_STOPWATCH).setSilent(true)
        }
        return builder.build()
    }

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
        .addAction(0, context.getString(I18nR.string.android_timer_stop), TimerActionReceiver.stop(context, habit.uuid))
        .addAction(0, context.getString(I18nR.string.android_timer_add_30s), TimerActionReceiver.add30s(context, habit.uuid))
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

        /** A habit timer's notification is tagged with its habit's uuid, under this prefix, and has [HABIT_ID]. */
        const val TAG_PREFIX = "habit-timer:"
        const val HABIT_ID = 1
        const val REST_TAG = "rest-timer"
        const val REST_ID = 1

        fun habitTag(habitUuid: String) = TAG_PREFIX + habitUuid
    }
}
