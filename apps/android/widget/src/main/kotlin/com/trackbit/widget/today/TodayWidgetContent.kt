package com.trackbit.widget.today

import android.content.Context
import android.text.format.DateFormat
import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.action.clickable
import androidx.glance.action.Action
import androidx.glance.appwidget.CheckBox
import androidx.glance.appwidget.LinearProgressIndicator
import androidx.glance.appwidget.components.CircleIconButton
import androidx.glance.appwidget.lazy.LazyColumn
import androidx.glance.appwidget.lazy.items
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.designsystem.color.colorAt
import com.trackbit.core.designsystem.icon.drawableRes
import com.trackbit.core.i18n.R as I18nR
import com.trackbit.core.model.HabitType
import com.trackbit.widget.R
import com.trackbit.widget.action.logAction
import com.trackbit.widget.ui.HabitDetails
import com.trackbit.widget.ui.WidgetMessage
import com.trackbit.widget.ui.WidgetSurface
import com.trackbit.widget.ui.openAppAction
import java.time.Instant
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Composable
internal fun TodayWidgetContent(state: TodayWidgetState) {
    val context = LocalContext.current
    val openApp = openAppAction(context)
    WidgetSurface {
        Header(day = (state as? TodayWidgetState.Tracking)?.day, onClick = openApp)
        when {
            state is TodayWidgetState.SignedOut ->
                WidgetMessage(context.getString(I18nR.string.android_widget_sign_in), openApp)
            state is TodayWidgetState.Tracking && state.habits.isEmpty() ->
                WidgetMessage(context.getString(I18nR.string.tracker_empty), openApp)
            state is TodayWidgetState.Tracking -> HabitList(state.habits, openApp)
        }
    }
}

@Composable
private fun Header(day: LocalDate?, onClick: Action) {
    val context = LocalContext.current
    Row(
        modifier = GlanceModifier.fillMaxWidth().padding(bottom = 6.dp).clickable(onClick),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = context.getString(I18nR.string.nav_tracker),
            style = TextStyle(color = GlanceTheme.colors.onSurface, fontSize = 16.sp, fontWeight = FontWeight.Medium),
            modifier = GlanceModifier.defaultWeight(),
        )
        if (day != null) {
            Text(
                text = day.format(shortDateFormatter(context)),
                style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 12.sp),
            )
        }
    }
}

/** "Mon, Sep 28" in the user's locale and order. */
private fun shortDateFormatter(context: Context): DateTimeFormatter {
    val locale = context.resources.configuration.locales[0]
    return DateTimeFormatter.ofPattern(DateFormat.getBestDateTimePattern(locale, "EEEMMMd"), locale)
}

@Composable
private fun HabitList(habits: List<TrackedHabit>, openApp: Action) {
    val context = LocalContext.current
    val (anti, regular) = habits.partition { it.isAntiHabit }
    LazyColumn {
        items(regular, itemId = { it.id.toLong() }) { HabitRow(it, openApp) }
        if (anti.isNotEmpty()) {
            item {
                Text(
                    text = context.getString(I18nR.string.tracker_anti_habits),
                    style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 12.sp, fontWeight = FontWeight.Medium),
                    modifier = GlanceModifier.padding(top = 8.dp, bottom = 2.dp),
                )
            }
            items(anti, itemId = { it.id.toLong() }) { HabitRow(it, openApp) }
        }
    }
}

@Composable
private fun HabitRow(habit: TrackedHabit, openApp: Action) {
    val context = LocalContext.current
    val muted = GlanceTheme.colors.onSurfaceVariant
    val habitColor = if (habit.frozen) muted else ColorProvider(habit.colorStops.colorAt(1f))
    // Workout sessions live in the app. Frozen rows do nothing at all: the lock says why.
    val rowModifier = GlanceModifier.fillMaxWidth().padding(vertical = 5.dp).let {
        if (habit.frozen || logAction(habit) != null) it else it.clickable(openApp)
    }
    Row(modifier = rowModifier, verticalAlignment = Alignment.CenterVertically) {
        Image(
            provider = ImageProvider(habit.icon.drawableRes),
            contentDescription = null,
            colorFilter = ColorFilter.tint(habitColor),
            modifier = GlanceModifier.size(22.dp),
        )
        Spacer(GlanceModifier.width(10.dp))
        Column(modifier = GlanceModifier.defaultWeight()) {
            Text(
                text = habit.name,
                maxLines = 1,
                style = TextStyle(color = if (habit.frozen) muted else GlanceTheme.colors.onSurface, fontSize = 14.sp),
            )
            HabitDetails(habit, style = TextStyle(color = muted, fontSize = 12.sp), modifier = GlanceModifier.fillMaxWidth())
            // Check habits show done-ness in their box; for anti-habits more isn't better.
            if (habit.type != HabitType.Check && !habit.isAntiHabit) {
                Spacer(GlanceModifier.height(3.dp))
                LinearProgressIndicator(
                    // A running timer counts as of this render; its time ticks in the details.
                    progress = habit.progressAt(Instant.now()).fraction,
                    color = habitColor,
                    backgroundColor = GlanceTheme.colors.surfaceVariant,
                    modifier = GlanceModifier.fillMaxWidth().height(3.dp),
                )
            }
        }
        Spacer(GlanceModifier.width(8.dp))
        TrailingControl(habit)
    }
}

@Composable
private fun TrailingControl(habit: TrackedHabit) {
    val context = LocalContext.current
    val log = logAction(habit)
    when {
        habit.frozen -> Image(
            provider = ImageProvider(R.drawable.ic_widget_lock),
            contentDescription = context.getString(I18nR.string.errors_limits_frozen_badge),
            colorFilter = ColorFilter.tint(GlanceTheme.colors.onSurfaceVariant),
            modifier = GlanceModifier.size(20.dp),
        )
        log == null -> Unit
        habit.type == HabitType.Check -> CheckBox(checked = habit.progress.isGoalMet, onCheckedChange = log)
        habit.type == HabitType.Timed -> RowButton(
            icon = if (habit.timer != null) R.drawable.ic_widget_stop else R.drawable.ic_widget_play,
            description = context.getString(
                if (habit.timer != null) I18nR.string.android_tracker_stop_timer else I18nR.string.android_tracker_start_timer,
                habit.name,
            ),
            onClick = log,
        )
        else -> RowButton(
            icon = R.drawable.ic_widget_plus,
            description = context.getString(I18nR.string.android_tracker_increment, habit.name),
            onClick = log,
        )
    }
}

@Composable
private fun RowButton(@DrawableRes icon: Int, description: String, onClick: Action) {
    CircleIconButton(
        imageProvider = ImageProvider(icon),
        contentDescription = description,
        onClick = onClick,
        backgroundColor = GlanceTheme.colors.secondaryContainer,
        contentColor = GlanceTheme.colors.onSecondaryContainer,
        modifier = GlanceModifier.size(36.dp),
    )
}
