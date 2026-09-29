package com.trackbit.widget.ui

import android.content.Context
import android.os.SystemClock
import android.view.Gravity
import android.widget.RemoteViews
import androidx.compose.runtime.Composable
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.designsystem.format.displayText
import com.trackbit.core.designsystem.format.formatDuration
import com.trackbit.core.i18n.R as I18nR
import com.trackbit.widget.R
import java.time.Duration
import java.time.Instant

/** "1 / 8 · 3 day streak · Frozen": progress, a streak from 2 days on, and the frozen badge. */
internal fun TrackedHabit.detailsText(context: Context): String? = details(context, progress.displayText(type))

private fun TrackedHabit.details(context: Context, progress: String?): String? = listOfNotNull(
    progress,
    streak?.takeIf { it >= 2 }?.let { context.resources.getQuantityString(I18nR.plurals.tracker_streak_badge, it, it) },
    context.getString(I18nR.string.errors_limits_frozen_badge).takeIf { frozen },
).takeIf { it.isNotEmpty() }?.joinToString(" · ")

/**
 * What follows a running timer's live time: " / 30:00 · 3 day streak". The goal is left out for a
 * timer logging to another day, since its time doesn't count toward this one.
 */
internal fun TrackedHabit.timerSuffix(context: Context): String = listOfNotNull(
    " / ${formatDuration(progress.goal)}".takeIf { timerAddsToDay },
    details(context, progress = null)?.let { " · $it" },
).joinToString("")

/** [detailsText] in one line. While a timer runs, its time ticks live in place of the logged value. */
@Composable
internal fun HabitDetails(habit: TrackedHabit, style: TextStyle, modifier: GlanceModifier = GlanceModifier) {
    val context = LocalContext.current
    val base = habit.timerBase
    if (base == null) {
        habit.detailsText(context)?.let { Text(text = it, maxLines = 1, style = style, modifier = modifier) }
    } else {
        TimerDetails(base, habit.timerSuffix(context), centered = style.textAlign == TextAlign.Center, modifier = modifier)
    }
}

/**
 * Time since [base], ticking in the launcher without re-rendering the widget, then [suffix].
 * Glance has no chronometer, so this is a plain RemoteViews layout; the chronometer's base is on
 * the elapsed-realtime clock.
 */
@Composable
private fun TimerDetails(base: Instant, suffix: String, centered: Boolean, modifier: GlanceModifier) {
    val context = LocalContext.current
    val elapsed = Duration.between(base, Instant.now()).toMillis().coerceAtLeast(0)
    val views = RemoteViews(context.packageName, R.layout.widget_timer).apply {
        setChronometer(R.id.widget_timer, SystemClock.elapsedRealtime() - elapsed, null, true)
        setTextViewText(R.id.widget_timer_suffix, suffix)
        setInt(R.id.widget_timer_row, "setGravity", if (centered) Gravity.CENTER_HORIZONTAL else Gravity.START)
    }
    AndroidRemoteViews(views, modifier = modifier)
}
