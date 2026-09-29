package com.trackbit.widget.heatmap

import androidx.compose.runtime.Composable
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
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
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
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.designsystem.color.colorAt
import com.trackbit.core.designsystem.icon.drawableRes
import com.trackbit.core.i18n.R as I18nR
import com.trackbit.core.model.RecentDay
import com.trackbit.widget.R
import com.trackbit.widget.habit.HabitWidgetState
import com.trackbit.widget.ui.HabitDetails
import com.trackbit.widget.ui.WidgetMessage
import com.trackbit.widget.ui.WidgetSurface
import com.trackbit.widget.ui.dayColor
import com.trackbit.widget.ui.detailsText
import com.trackbit.widget.ui.openAppAction
import java.time.DayOfWeek
import kotlin.math.floor

private val Padding = 12.dp
private val HeaderHeight = 20.dp
private val HeaderGap = 8.dp

/** A cell's pitch (size plus gap) stays within these: legible, and not a few giant squares. */
private val MinPitch = 8.dp
private val MaxPitch = 18.dp

/** Glance drops a Row's or Column's children past the tenth, so week columns go in groups. */
private const val MAX_CHILDREN = 10

/** [chooseHabit] opens the habit picker for this widget. */
@Composable
internal fun HeatmapWidgetContent(state: HabitWidgetState, firstDayOfWeek: DayOfWeek, chooseHabit: Action) {
    val context = LocalContext.current
    WidgetSurface(horizontalPadding = Padding, verticalPadding = Padding) {
        when (state) {
            HabitWidgetState.SignedOut ->
                WidgetMessage(context.getString(I18nR.string.android_widget_sign_in), openAppAction(context))
            HabitWidgetState.Unconfigured ->
                WidgetMessage(context.getString(I18nR.string.android_widget_choose_habit), chooseHabit)
            HabitWidgetState.HabitRemoved ->
                WidgetMessage(context.getString(I18nR.string.android_widget_habit_removed), chooseHabit)
            is HabitWidgetState.Tracking -> Heatmap(state.habit, HeatmapWindow(state.habit.day, firstDayOfWeek))
        }
    }
}

/** Header and grid. Read-only: the whole widget opens the app (analytics, once it exists). */
@Composable
private fun Heatmap(habit: TrackedHabit, window: HeatmapWindow) {
    val context = LocalContext.current
    val grid = gridFor(LocalSize.current)
    Column(
        modifier = GlanceModifier.fillMaxSize()
            .clickable(openAppAction(context))
            .semantics { contentDescription = listOfNotNull(habit.name, habit.detailsText(context)).joinToString(", ") },
    ) {
        Header(habit)
        Spacer(GlanceModifier.height(HeaderGap))
        Box(modifier = GlanceModifier.fillMaxWidth().defaultWeight(), contentAlignment = Alignment.TopCenter) {
            Grid(habit, window.weeks(habit.recent, grid.weeks), grid.pitch)
        }
    }
}

@Composable
private fun Header(habit: TrackedHabit) {
    val muted = GlanceTheme.colors.onSurfaceVariant
    Row(modifier = GlanceModifier.fillMaxWidth().height(HeaderHeight), verticalAlignment = Alignment.CenterVertically) {
        Image(
            provider = ImageProvider(habit.icon.drawableRes),
            contentDescription = null,
            colorFilter = ColorFilter.tint(if (habit.frozen) muted else ColorProvider(habit.colorStops.colorAt(1f))),
            modifier = GlanceModifier.size(16.dp),
        )
        Spacer(GlanceModifier.width(6.dp))
        Text(
            text = habit.name,
            maxLines = 1,
            style = TextStyle(color = GlanceTheme.colors.onSurface, fontSize = 14.sp, fontWeight = FontWeight.Medium),
            modifier = GlanceModifier.defaultWeight(),
        )
        Spacer(GlanceModifier.width(8.dp))
        HabitDetails(habit, style = TextStyle(color = muted, fontSize = 12.sp))
    }
}

internal data class GridSize(val weeks: Int, val pitch: Dp)

/** Cells as large as the height allows (within bounds), then as many weeks as fit the width. */
internal fun gridFor(size: DpSize): GridSize {
    val width = size.width - Padding * 2
    val height = size.height - Padding * 2 - HeaderHeight - HeaderGap
    val pitch = (height / HeatmapWindow.DAYS_PER_WEEK).coerceIn(MinPitch, MaxPitch)
    val weeks = floor(width / pitch).toInt().coerceIn(1, HeatmapWindow.MAX_WEEKS)
    return GridSize(weeks, pitch)
}

/** One column per week, days top to bottom; today's week is last and ends at today. */
@Composable
private fun Grid(habit: TrackedHabit, weeks: List<List<RecentDay?>>, pitch: Dp) {
    Row {
        weeks.chunked(MAX_CHILDREN).forEach { group ->
            Row {
                group.forEach { week ->
                    Column { week.forEach { day -> if (day != null) Cell(habit.dayColor(day), pitch) } }
                }
            }
        }
    }
}

/**
 * A rounded square, inset by its padding for the gap. Like the web, a day's color is drawn over
 * the empty cell, since the gradient's low end is mostly transparent. One view when empty, as
 * most are: a grid is up to 182 cells.
 */
@Composable
private fun Cell(color: ColorProvider?, pitch: Dp) {
    val inset = pitch / 8
    val empty = ColorFilter.tint(GlanceTheme.colors.surfaceVariant)
    val shape = ImageProvider(R.drawable.ic_widget_cell)
    if (color == null) {
        Image(shape, contentDescription = null, colorFilter = empty, modifier = GlanceModifier.size(pitch).padding(inset))
    } else {
        Box(modifier = GlanceModifier.size(pitch)) {
            Image(shape, contentDescription = null, colorFilter = empty, modifier = GlanceModifier.fillMaxSize().padding(inset))
            Image(shape, contentDescription = null, colorFilter = ColorFilter.tint(color), modifier = GlanceModifier.fillMaxSize().padding(inset))
        }
    }
}
