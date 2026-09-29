package com.trackbit.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.time.LocalDate
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The local day widgets show. Widgets can't tick like a screen's `DayClock`, so the day is
 * re-read whenever a widget renders ([refresh] from `provideGlance`) and by an alarm at the next
 * local midnight ([DayRolloverReceiver]), which re-arms itself while widgets are placed.
 */
@Singleton
class WidgetDay @Inject internal constructor(
    @ApplicationContext private val context: Context,
) {
    private val current = MutableStateFlow(LocalDate.now())

    val today: StateFlow<LocalDate> = current.asStateFlow()

    /** Re-reads the day, and arms the alarm for the midnight that ends it. */
    fun refresh() {
        val now = ZonedDateTime.now()
        current.value = now.toLocalDate()
        // Not a wakeup alarm: a sleeping device can't show the widget anyway, and the alarm is
        // delivered as soon as it wakes. Android 12+ widens the window to 10 minutes; an exact
        // alarm would need the user to grant SCHEDULE_EXACT_ALARM.
        context.getSystemService(AlarmManager::class.java).setWindow(
            AlarmManager.RTC,
            nextMidnight(now).toInstant().toEpochMilli(),
            ROLLOVER_WINDOW_MILLIS,
            rolloverIntent(),
        )
    }

    private fun rolloverIntent(): PendingIntent = PendingIntent.getBroadcast(
        context,
        0,
        Intent(context, DayRolloverReceiver::class.java).setAction(DayRolloverReceiver.ACTION_ROLLOVER),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private companion object {
        val ROLLOVER_WINDOW_MILLIS = TimeUnit.MINUTES.toMillis(1)
    }
}

/** The start of the day after [now], in its zone. On a DST day that skips midnight, it's 01:00. */
internal fun nextMidnight(now: ZonedDateTime): ZonedDateTime =
    now.toLocalDate().plusDays(1).atStartOfDay(now.zone)
