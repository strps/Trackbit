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
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.designsystem.color.colorAt
import com.trackbit.core.designsystem.format.formatDuration
import com.trackbit.core.designsystem.icon.drawableRes
import com.trackbit.core.i18n.R as I18nR
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * One ongoing notification per running timer, kept in step with Room: whatever starts or stops a
 * timer (a widget, the app, the notification itself, a habit deleted by a sync, sign-out clearing
 * the database), this posts or cancels to match. Call [start] once, from `Application.onCreate`;
 * a new process re-posts the timers that are still running.
 *
 * No foreground service: a timer is a stored start instant, and the notification's chronometer
 * ticks in the system UI, so nothing has to keep running meanwhile.
 */
@Singleton
class TimerNotifier @Inject internal constructor(
    @ApplicationContext private val context: Context,
    private val tracker: TrackerRepository,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val manager = NotificationManagerCompat.from(context)

    /** The last timers seen, to post them once notifications are allowed. */
    @Volatile private var running: List<TrackedHabit> = emptyList()

    fun start() {
        manager.createNotificationChannel(
            NotificationChannelCompat.Builder(CHANNEL, NotificationManagerCompat.IMPORTANCE_LOW)
                .setName(context.getString(I18nR.string.android_timer_channel_name))
                .setDescription(context.getString(I18nR.string.android_timer_channel_description))
                .setShowBadge(false)
                .build(),
        )
        scope.launch {
            tracker.observeRunningTimers().distinctUntilChanged().collect(::show)
        }
    }

    /** Posts the running timers after the user allows notifications. */
    fun onPermissionGranted() {
        scope.launch { show(running) }
    }

    private fun show(habits: List<TrackedHabit>) {
        running = habits
        val ids = habits.map { it.id }.toSet()
        context.getSystemService(NotificationManager::class.java).activeNotifications
            .filter { it.tag == TAG && it.id !in ids }
            .forEach { manager.cancel(TAG, it.id) }
        // Without the permission (13+) timers still run; they show in the widgets only.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        habits.forEach { manager.notify(TAG, it.id, notification(it)) }
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
        .addAction(0, context.getString(I18nR.string.android_timer_stop), TimerActionReceiver.stop(context, habit.id))
        .addAction(0, context.getString(I18nR.string.android_timer_add_30s), TimerActionReceiver.add30s(context, habit.id))
        .build()

    private fun openApp(): PendingIntent = PendingIntent.getActivity(
        context,
        0,
        Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_IMMUTABLE,
    )

    private companion object {
        const val CHANNEL = "timers"

        /** Notification ids are habit ids, under this tag so they can't clash with others. */
        const val TAG = "habit-timer"
    }
}
