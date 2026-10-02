package com.trackbit.feature.tracker

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.FilledIconToggleButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.designsystem.color.colorAt
import com.trackbit.core.designsystem.format.displayText
import com.trackbit.core.designsystem.format.formatDuration
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.designsystem.icon.painter
import com.trackbit.core.i18n.R
import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.ProgressState
import kotlinx.coroutines.delay
import java.time.Clock
import java.time.Instant

/** What a row can do; each takes the row's habit, whose day is the one shown. */
internal class HabitRowActions(
    val onIncrement: (TrackedHabit, Int) -> Unit,
    val onToggle: (TrackedHabit) -> Unit,
    val onToggleTimer: (TrackedHabit) -> Unit,
    val onEditTime: (TrackedHabit) -> Unit,
    val onOpenSession: (TrackedHabit) -> Unit,
)

/**
 * One habit on the shown day, like the web's tracker rows: the habit's color and icon on the left,
 * name, progress and badges in the middle, and the control for its type on the right. A frozen
 * habit shows a lock and its controls are disabled.
 */
@Composable
internal fun HabitRow(habit: TrackedHabit, actions: HabitRowActions, modifier: Modifier = Modifier) {
    val now by rememberNow(ticking = habit.timerAddsToDay)
    val progress = habit.progressAt(now)
    val accent = habit.colorStops.colorAt(1f)
    // Untouched rows recede, as on the web.
    val contentAlpha = if (progress.value == 0L && habit.timer == null) INACTIVE_ALPHA else 1f

    Card(modifier.fillMaxWidth()) {
        Row(Modifier.height(IntrinsicSize.Min), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.width(48.dp).fillMaxHeight().alpha(contentAlpha).background(accent),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    painter = if (habit.frozen) painterResource(UiIcons.Lock) else habit.icon.painter(),
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(22.dp),
                )
            }
            Column(
                Modifier.weight(1f).padding(start = 12.dp, top = 10.dp, bottom = 10.dp, end = 4.dp).alpha(contentAlpha),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text(
                    text = habit.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = subtitle(habit, progress),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Badges(habit, progress)
            }
            Box(Modifier.padding(end = 8.dp)) { Control(habit, progress, accent, actions) }
        }
    }
}

@Composable
private fun subtitle(habit: TrackedHabit, progress: HabitProgress): String {
    val anti = habit.isAntiHabit
    val untouched = progress.value == 0L && habit.timer == null
    return when (habit.type) {
        HabitType.Check -> when {
            anti -> stringResource(if (progress.isGoalMet) R.string.tracker_badge_slipped else R.string.tracker_badge_avoided)
            else -> stringResource(if (progress.isGoalMet) R.string.tracker_check_completed else R.string.tracker_check_not_yet)
        }
        HabitType.Complex -> {
            val count = progress.value.toInt()
            if (count > 0) pluralStringResource(R.plurals.tracker_sessions, count, count) else stringResource(R.string.tracker_no_sessions)
        }
        HabitType.Timed ->
            if (anti && untouched) stringResource(R.string.tracker_badge_avoided) else progress.displayText(habit.type).orEmpty()
        HabitType.Count, HabitType.Negative, HabitType.Unknown -> {
            val value = progress.value.toString()
            val goal = progress.goal.toString()
            when {
                anti && untouched -> stringResource(R.string.tracker_badge_avoided)
                anti -> stringResource(R.string.tracker_count_slips, value, goal)
                else -> stringResource(R.string.tracker_count_completed, value, goal)
            }
        }
    }
}

@Composable
private fun Badges(habit: TrackedHabit, progress: HabitProgress) {
    val colors = MaterialTheme.colorScheme
    val state = progress.state
    val streak = habit.streak?.takeIf { it >= 2 }
    // The line is always laid out, so a first badge doesn't grow the row under the user's finger.
    if (state == ProgressState.NotStarted && streak == null && !habit.frozen) {
        Badge(UiIcons.Trophy, "", Color.Transparent, Color.Transparent, Modifier.padding(top = 4.dp).alpha(0f))
        return
    }
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.padding(top = 4.dp),
    ) {
        when (state) {
            ProgressState.NotStarted -> Unit
            ProgressState.Started -> Badge(UiIcons.Trophy, R.string.tracker_badge_started, colors.surfaceVariant, colors.onSurfaceVariant)
            ProgressState.Halfway -> Badge(UiIcons.Trophy, R.string.tracker_badge_halfway, colors.secondaryContainer, colors.onSecondaryContainer)
            ProgressState.Done -> Badge(UiIcons.Trophy, R.string.tracker_badge_done, colors.primaryContainer, colors.onPrimaryContainer)
            ProgressState.Avoided -> Badge(UiIcons.ShieldAlert, R.string.tracker_badge_avoided, colors.tertiaryContainer, colors.onTertiaryContainer)
            ProgressState.Slipped -> Badge(UiIcons.ShieldAlert, R.string.tracker_badge_slipped, colors.errorContainer, colors.onErrorContainer)
        }
        if (streak != null) {
            Badge(UiIcons.Flame, pluralStringResource(R.plurals.tracker_streak_badge, streak, streak), colors.secondaryContainer, colors.onSecondaryContainer)
        }
        if (habit.frozen) {
            Badge(UiIcons.Lock, R.string.errors_limits_frozen_badge, colors.surfaceVariant, colors.onSurfaceVariant)
        }
    }
}

@Composable
private fun Badge(@DrawableRes icon: Int, text: Int, container: Color, content: Color) =
    Badge(icon, stringResource(text), container, content)

@Composable
private fun Badge(@DrawableRes icon: Int, text: String, container: Color, content: Color, modifier: Modifier = Modifier) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = modifier
            .background(container, RoundedCornerShape(50))
            .padding(horizontal = 8.dp, vertical = 2.dp),
    ) {
        Icon(painterResource(icon), contentDescription = null, tint = content, modifier = Modifier.size(12.dp))
        Text(text, style = MaterialTheme.typography.labelSmall, color = content)
    }
}

@Composable
private fun Control(habit: TrackedHabit, progress: HabitProgress, accent: Color, actions: HabitRowActions) {
    val enabled = !habit.frozen
    when (habit.type) {
        HabitType.Check -> {
            val done = progress.isGoalMet
            val description = stringResource(
                if (done) R.string.android_tracker_mark_not_done else R.string.android_tracker_mark_done,
                habit.name,
            )
            FilledIconToggleButton(
                checked = done,
                onCheckedChange = { actions.onToggle(habit) },
                enabled = enabled,
                colors = IconButtonDefaults.filledIconToggleButtonColors(checkedContainerColor = accent, checkedContentColor = Color.White),
                modifier = Modifier.semantics { contentDescription = description },
            ) {
                Icon(painterResource(UiIcons.Check), contentDescription = null)
            }
        }
        HabitType.Count, HabitType.Negative -> Row(verticalAlignment = Alignment.CenterVertically) {
            val decrement = stringResource(R.string.android_tracker_decrement, habit.name)
            val increment = stringResource(R.string.android_tracker_increment, habit.name)
            IconButton(
                onClick = { actions.onIncrement(habit, -1) },
                enabled = enabled && progress.value > 0,
                modifier = Modifier.semantics { contentDescription = decrement },
            ) {
                Icon(painterResource(UiIcons.Minus), contentDescription = null)
            }
            Text(
                text = progress.value.toString(),
                style = MaterialTheme.typography.titleMedium,
                color = if (progress.isGoalMet) accent else MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
                modifier = Modifier.widthIn(min = 24.dp),
            )
            FilledTonalIconButton(
                onClick = { actions.onIncrement(habit, 1) },
                enabled = enabled,
                modifier = Modifier.semantics { contentDescription = increment },
            ) {
                Icon(painterResource(UiIcons.Plus), contentDescription = null)
            }
        }
        HabitType.Timed -> Row(verticalAlignment = Alignment.CenterVertically) {
            val running = habit.timer != null
            val edit = stringResource(R.string.android_tracker_edit_time, habit.name)
            // The total is edited only while no timer runs, so the two never fight over it.
            TextButton(
                onClick = { actions.onEditTime(habit) },
                enabled = enabled && !running,
                modifier = Modifier.semantics { contentDescription = edit },
            ) {
                Text(formatDuration(progress.value), style = MaterialTheme.typography.titleMedium)
            }
            val timer = stringResource(
                if (running) R.string.android_tracker_stop_timer else R.string.android_tracker_start_timer,
                habit.name,
            )
            FilledTonalIconButton(
                onClick = { actions.onToggleTimer(habit) },
                enabled = enabled,
                modifier = Modifier.semantics { contentDescription = timer },
            ) {
                Icon(painterResource(if (running) UiIcons.Stop else UiIcons.Play), contentDescription = null)
            }
        }
        HabitType.Complex -> {
            val description = stringResource(R.string.android_tracker_open_session, habit.name)
            OutlinedIconButton(
                onClick = { actions.onOpenSession(habit) },
                enabled = enabled,
                modifier = Modifier.semantics { contentDescription = description },
            ) {
                Icon(painterResource(UiIcons.Play), contentDescription = null)
            }
        }
        // A type this build doesn't know: shown, not editable.
        HabitType.Unknown -> Unit
    }
}

/** The current instant, re-read every second while [ticking] (a running timer shows live time). */
@Composable
private fun rememberNow(ticking: Boolean, clock: Clock = Clock.systemUTC()) =
    produceState<Instant>(clock.instant(), ticking) {
        value = clock.instant()
        while (ticking) {
            delay(1_000 - clock.millis() % 1_000)
            value = clock.instant()
        }
    }

private const val INACTIVE_ALPHA = 0.6f
