package com.trackbit.widget.ui

import androidx.compose.runtime.Composable
import androidx.glance.GlanceTheme
import androidx.glance.unit.ColorProvider
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.designsystem.color.colorAt
import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.RecentDay

/**
 * How a past day shows on the heatmap scale (W1's strip, W3): the habit's gradient at the day's
 * progress, like the web `Heatmap`. Anti-habits mark only slips, in the error color: clean days
 * aren't known without the first log day. Null: nothing to mark.
 */
@Composable
internal fun TrackedHabit.dayColor(day: RecentDay): ColorProvider? {
    val progress = HabitProgress.of(this, day.rating, day.sessionCount)
    return when {
        isAntiHabit -> if (progress.value > 0) GlanceTheme.colors.error else null
        progress.fraction > 0f -> ColorProvider(colorStops.colorAt(progress.fraction))
        else -> null
    }
}
