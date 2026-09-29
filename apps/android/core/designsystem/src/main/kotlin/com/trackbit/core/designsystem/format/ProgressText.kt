package com.trackbit.core.designsystem.format

import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.HabitType

/**
 * "3 / 8", or durations for timed habits; null for check habits, whose checkbox says it all.
 * Shared by the tracker screen and the widgets.
 */
fun HabitProgress.displayText(type: HabitType): String? = when (type) {
    HabitType.Check -> null
    HabitType.Timed -> "${formatDuration(value)} / ${formatDuration(goal)}"
    else -> "$value / $goal"
}

/** "4:05", or "1:04:05" from an hour on. */
fun formatDuration(ms: Long): String {
    val totalSeconds = ms / 1000
    val hours = totalSeconds / 3600
    val minutes = totalSeconds % 3600 / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, seconds) else "%d:%02d".format(minutes, seconds)
}
