package com.trackbit.feature.tracker

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.selection.toggleable
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.designsystem.color.colorAt
import com.trackbit.core.designsystem.icon.painter
import com.trackbit.core.i18n.R
import com.trackbit.core.model.HabitType
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

/** Placeholder Today screen: rows from Room, +1 / toggle through the outbox, pull-to-refresh. */
@Composable
fun TodayScreen(onSignOut: () -> Unit, viewModel: TodayViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    state.message?.let { message ->
        val text = stringResource(message.textRes)
        LaunchedEffect(message) {
            snackbar.showSnackbar(text)
            viewModel.onMessageShown(message)
        }
    }

    TodayContent(
        state = state,
        snackbar = snackbar,
        onRefresh = viewModel::refresh,
        onIncrement = viewModel::increment,
        onToggle = viewModel::toggle,
        onSignOut = onSignOut,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TodayContent(
    state: TodayUiState,
    snackbar: SnackbarHostState,
    onRefresh: () -> Unit,
    onIncrement: (TrackedHabit) -> Unit,
    onToggle: (TrackedHabit) -> Unit,
    onSignOut: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(stringResource(R.string.nav_tracker))
                        state.day?.let {
                            Text(
                                text = it.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL)),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                },
                actions = {
                    TextButton(onClick = onSignOut) { Text(stringResource(R.string.nav_log_out)) }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.refreshing,
            onRefresh = onRefresh,
            modifier = Modifier.padding(padding).fillMaxSize(),
        ) {
            // Always a scrollable list, so pull-to-refresh works while loading or empty too.
            LazyColumn(Modifier.fillMaxSize()) {
                if (state.pendingWrites > 0) {
                    item {
                        Text(
                            text = pluralStringResource(
                                R.plurals.android_tracker_pending, state.pendingWrites, state.pendingWrites,
                            ),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                    }
                }
                val habits = state.habits
                when {
                    habits == null -> item { CenteredText(R.string.tracker_loading) }
                    habits.isEmpty() -> item { CenteredText(R.string.tracker_empty) }
                    else -> {
                        val (anti, regular) = habits.partition { it.isAntiHabit }
                        items(regular, key = { it.id }) { HabitRow(it, onIncrement, onToggle) }
                        if (anti.isNotEmpty()) {
                            item {
                                Text(
                                    text = stringResource(R.string.tracker_anti_habits),
                                    style = MaterialTheme.typography.titleSmall,
                                    modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp),
                                )
                            }
                            items(anti, key = { it.id }) { HabitRow(it, onIncrement, onToggle) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HabitRow(
    habit: TrackedHabit,
    onIncrement: (TrackedHabit) -> Unit,
    onToggle: (TrackedHabit) -> Unit,
) {
    val isCheck = habit.type == HabitType.Check
    val done = habit.progress.isGoalMet
    val rowModifier = if (isCheck) {
        Modifier.toggleable(value = done, enabled = !habit.frozen, role = Role.Checkbox) { onToggle(habit) }
    } else {
        Modifier
    }
    ListItem(
        modifier = rowModifier,
        leadingContent = {
            Icon(
                painter = habit.icon.painter(),
                contentDescription = null,
                tint = habit.colorStops.colorAt(1f),
                modifier = Modifier.size(28.dp),
            )
        },
        headlineContent = { Text(habit.name) },
        supportingContent = {
            val details = listOfNotNull(
                habit.progressText(),
                habit.streak?.takeIf { it >= 2 }?.let {
                    pluralStringResource(R.plurals.tracker_streak_badge, it, it)
                },
                stringResource(R.string.errors_limits_frozen_badge).takeIf { habit.frozen },
            )
            if (details.isNotEmpty()) Text(details.joinToString(" · "))
        },
        trailingContent = {
            when (habit.type) {
                // The row itself is the toggle; the box only shows the state.
                HabitType.Check -> Checkbox(checked = done, onCheckedChange = null, enabled = !habit.frozen)
                HabitType.Count, HabitType.Negative -> {
                    val description = stringResource(R.string.android_tracker_increment, habit.name)
                    FilledTonalButton(
                        onClick = { onIncrement(habit) },
                        enabled = !habit.frozen,
                        modifier = Modifier.semantics { contentDescription = description },
                    ) { Text("+1") }
                }
                // Timers and workout sessions arrive with the Phase 2 tracker.
                HabitType.Timed, HabitType.Complex, HabitType.Unknown -> Unit
            }
        },
    )
}

/** "3 / 8", or durations for timed habits; nothing for check habits, whose box says it all. */
private fun TrackedHabit.progressText(): String? = when (type) {
    HabitType.Check -> null
    HabitType.Timed -> "${formatDuration(progress.value)} / ${formatDuration(progress.goal)}"
    else -> "${progress.value} / ${progress.goal}"
}

internal fun formatDuration(ms: Long): String {
    val totalSeconds = ms / 1000
    val hours = totalSeconds / 3600
    val minutes = totalSeconds % 3600 / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, seconds) else "%d:%02d".format(minutes, seconds)
}

@Composable
private fun CenteredText(@StringRes text: Int) {
    Row(Modifier.fillMaxWidth().padding(32.dp), horizontalArrangement = Arrangement.Center) {
        Text(
            text = stringResource(text),
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@get:StringRes
private val TodayMessage.textRes: Int
    get() = when (this) {
        TodayMessage.Offline -> R.string.android_tracker_offline
        TodayMessage.SyncFailed -> R.string.errors_generic_title
        TodayMessage.HabitFrozen -> R.string.errors_limits_habit_frozen_body
    }
