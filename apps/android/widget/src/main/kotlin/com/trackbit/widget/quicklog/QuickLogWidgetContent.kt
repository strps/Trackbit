package com.trackbit.widget.quicklog

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalContext
import androidx.glance.LocalSize
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.size
import androidx.glance.layout.width
import androidx.glance.semantics.contentDescription
import androidx.glance.semantics.semantics
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.designsystem.color.colorAt
import com.trackbit.core.designsystem.icon.drawableRes
import com.trackbit.core.i18n.R as I18nR
import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.RecentDay
import com.trackbit.widget.R
import com.trackbit.widget.action.logAction
import com.trackbit.widget.ui.ProgressRing
import com.trackbit.widget.ui.WidgetMessage
import com.trackbit.widget.ui.WidgetSurface
import com.trackbit.widget.ui.detailsText
import com.trackbit.widget.ui.openAppAction

/** The three layouts, one per [QuickLogWidget] size: ring; ring + text; ring + text + week. */
private enum class Layout { Small, Wide, Square }

private fun layoutFor(size: DpSize): Layout = when {
    size.width < QuickLogWidget.WIDE.width -> Layout.Small
    size.height < QuickLogWidget.SQUARE.height -> Layout.Wide
    else -> Layout.Square
}

/** [chooseHabit] opens the configuration activity for this widget. */
@Composable
internal fun QuickLogWidgetContent(state: QuickLogState, chooseHabit: Action) {
    val context = LocalContext.current
    val layout = layoutFor(LocalSize.current)
    val padding = if (layout == Layout.Square) 12.dp else 8.dp
    WidgetSurface(horizontalPadding = padding, verticalPadding = padding) {
        val small = layout == Layout.Small
        when (state) {
            QuickLogState.SignedOut -> WidgetMessage(
                context.getString(if (small) I18nR.string.android_widget_sign_in_short else I18nR.string.android_widget_sign_in),
                openAppAction(context),
            )
            QuickLogState.Unconfigured ->
                WidgetMessage(context.getString(I18nR.string.android_widget_quick_log_choose), chooseHabit)
            QuickLogState.HabitRemoved -> WidgetMessage(
                context.getString(if (small) I18nR.string.android_widget_quick_log_choose else I18nR.string.android_widget_quick_log_removed),
                chooseHabit,
            )
            is QuickLogState.Tracking -> HabitContent(state.habit, layout)
        }
    }
}

/**
 * The whole widget is one tap target: it logs the habit, opens the app for types the widget
 * can't log, and does nothing while the habit is frozen (the lock says why).
 */
@Composable
private fun HabitContent(habit: TrackedHabit, layout: Layout) {
    val context = LocalContext.current
    val log = logAction(habit)
    val tap = if (habit.frozen) null else log ?: openAppAction(context)
    val modifier = GlanceModifier.fillMaxSize()
        .semantics { contentDescription = tapDescription(context, habit, logs = log != null) }
        .let { if (tap != null) it.clickable(tap) else it }
    when (layout) {
        Layout.Small -> HabitRing(habit, iconSize = 22.dp, modifier = modifier)
        Layout.Wide -> Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically) {
            HabitRing(habit, iconSize = 18.dp, modifier = GlanceModifier.width(44.dp).fillMaxHeight())
            Spacer(GlanceModifier.width(8.dp))
            Column(modifier = GlanceModifier.defaultWeight()) { HabitText(habit, TextAlign.Start) }
        }
        Layout.Square -> Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
            HabitRing(habit, iconSize = 26.dp, modifier = GlanceModifier.defaultWeight().fillMaxWidth())
            Spacer(GlanceModifier.height(4.dp))
            HabitText(habit, TextAlign.Center)
            Spacer(GlanceModifier.height(6.dp))
            WeekStrip(habit)
        }
    }
}

/** What a tap does, for TalkBack: the whole widget is the button. */
private fun tapDescription(context: Context, habit: TrackedHabit, logs: Boolean): String = when {
    habit.frozen || !logs -> listOfNotNull(habit.name, habit.detailsText(context)).joinToString(", ")
    habit.type == HabitType.Check -> context.getString(
        if (habit.progress.isGoalMet) I18nR.string.android_tracker_mark_not_done else I18nR.string.android_tracker_mark_done,
        habit.name,
    )
    else -> context.getString(I18nR.string.android_tracker_increment, habit.name)
}

/**
 * Today's progress in the habit's color. Anti-habits have no goal to fill toward: the ring is
 * full while the day is clean and turns to the error color on a slip. Frozen: the bare track
 * and a lock.
 */
@Composable
private fun HabitRing(habit: TrackedHabit, iconSize: Dp, modifier: GlanceModifier) {
    val color = habit.colorStops.colorAt(1f)
    val slipped = habit.isAntiHabit && habit.progress.value > 0
    val fraction = when {
        habit.frozen || slipped -> 0f
        habit.isAntiHabit -> 1f
        else -> habit.progress.fraction
    }
    ProgressRing(
        fraction = fraction,
        color = color.toArgb(),
        trackColor = if (slipped) GlanceTheme.colors.error else GlanceTheme.colors.surfaceVariant,
        modifier = modifier,
    ) {
        Image(
            provider = ImageProvider(if (habit.frozen) R.drawable.ic_widget_lock else habit.icon.drawableRes),
            contentDescription = null,
            colorFilter = ColorFilter.tint(if (habit.frozen) GlanceTheme.colors.onSurfaceVariant else ColorProvider(color)),
            modifier = GlanceModifier.size(iconSize),
        )
    }
}

@Composable
private fun HabitText(habit: TrackedHabit, align: TextAlign) {
    val context = LocalContext.current
    Text(
        text = habit.name,
        maxLines = 1,
        style = TextStyle(
            color = if (habit.frozen) GlanceTheme.colors.onSurfaceVariant else GlanceTheme.colors.onSurface,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            textAlign = align,
        ),
        modifier = GlanceModifier.fillMaxWidth(),
    )
    habit.detailsText(context)?.let {
        Text(
            text = it,
            maxLines = 1,
            style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 12.sp, textAlign = align),
            modifier = GlanceModifier.fillMaxWidth(),
        )
    }
}

/**
 * The last seven days, oldest first, ending today. Each day on the heatmap's scale (the habit's
 * gradient at that day's progress); for anti-habits only slips are marked.
 */
@Composable
private fun WeekStrip(habit: TrackedHabit) {
    // Gaps are padding, not Spacers: Glance drops a Row's children past the tenth.
    Row(modifier = GlanceModifier.fillMaxWidth()) {
        habit.recent.forEach { day ->
            Box(modifier = GlanceModifier.defaultWeight().padding(horizontal = 1.5.dp)) {
                Box(
                    modifier = GlanceModifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .cornerRadius(3.dp)
                        .background(dayColor(habit, day)),
                ) {}
            }
        }
    }
}

@Composable
private fun dayColor(habit: TrackedHabit, day: RecentDay): ColorProvider {
    val progress = HabitProgress.of(habit, day.rating, day.sessionCount)
    return when {
        habit.isAntiHabit -> if (progress.value > 0) GlanceTheme.colors.error else GlanceTheme.colors.surfaceVariant
        progress.fraction > 0f -> ColorProvider(habit.colorStops.colorAt(progress.fraction))
        else -> GlanceTheme.colors.surfaceVariant
    }
}
