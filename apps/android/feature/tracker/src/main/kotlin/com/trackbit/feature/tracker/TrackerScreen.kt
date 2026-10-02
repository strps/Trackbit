package com.trackbit.feature.tracker

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedIconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

/**
 * The tracker home, like the web's `/tracker`: every habit on today or a past day, logged
 * through the outbox. [onOpenSession] opens a workout habit's session for the shown day.
 */
@Composable
fun TrackerScreen(
    onSignOut: () -> Unit,
    onOpenSession: (habitId: Int, day: LocalDate) -> Unit,
    viewModel: TrackerViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    state.message?.let { message ->
        val text = stringResource(message.textRes)
        LaunchedEffect(message) {
            snackbar.showSnackbar(text)
            viewModel.onMessageShown(message)
        }
    }

    // The habit whose time is being edited, by id: the row's data stays live underneath.
    var editingTimeOf by rememberSaveable { mutableStateOf<Int?>(null) }
    val actions = remember(viewModel) {
        HabitRowActions(
            onIncrement = viewModel::increment,
            onToggle = viewModel::toggle,
            onToggleTimer = viewModel::toggleTimer,
            onEditTime = { editingTimeOf = it.id },
            onOpenSession = { onOpenSession(it.id, it.day) },
        )
    }

    TrackerContent(
        state = state,
        snackbar = snackbar,
        actions = actions,
        onRefresh = viewModel::refresh,
        onSelectDay = viewModel::selectDay,
        onMoveDay = viewModel::moveDay,
        onSignOut = onSignOut,
    )

    val editing = editingTimeOf?.let { id -> state.habits?.find { it.id == id } }
    if (editing != null) {
        TimeDialog(
            habitName = editing.name,
            initialMs = editing.progress.value,
            onDismiss = { editingTimeOf = null },
            onSave = { ms ->
                viewModel.setTime(editing, ms)
                editingTimeOf = null
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TrackerContent(
    state: TrackerUiState,
    snackbar: SnackbarHostState,
    actions: HabitRowActions,
    onRefresh: () -> Unit,
    onSelectDay: (LocalDate) -> Unit,
    onMoveDay: (Long) -> Unit,
    onSignOut: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.nav_tracker)) },
                actions = { OverflowMenu(onSignOut) },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            if (state.day != null && state.today != null) {
                DayBar(state.day, state.today, onSelectDay, onMoveDay)
            }
            PullToRefreshBox(
                isRefreshing = state.refreshing,
                onRefresh = onRefresh,
                modifier = Modifier.fillMaxSize(),
            ) {
                // Always a scrollable list, so pull-to-refresh works while loading or empty too.
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (state.pendingWrites > 0) {
                        item {
                            Text(
                                text = pluralStringResource(
                                    R.plurals.android_tracker_pending, state.pendingWrites, state.pendingWrites,
                                ),
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    habitItems(state.habits, actions)
                }
            }
        }
    }
}

private fun LazyListScope.habitItems(habits: List<TrackedHabit>?, actions: HabitRowActions) {
    when {
        habits == null -> item { CenteredText(R.string.tracker_loading) }
        habits.isEmpty() -> item { CenteredText(R.string.tracker_empty) }
        else -> {
            val (anti, regular) = habits.partition { it.isAntiHabit }
            items(regular, key = { it.id }) { HabitRow(it, actions) }
            if (anti.isNotEmpty()) {
                item(key = "anti-habits") {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
                    ) {
                        Icon(
                            painterResource(UiIcons.ShieldAlert),
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(20.dp),
                        )
                        Text(
                            text = stringResource(R.string.tracker_anti_habits),
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                items(anti, key = { it.id }) { HabitRow(it, actions) }
            }
        }
    }
}

/** ‹ day › plus "go to today", like the web's date selector. The day opens a date picker. */
@Composable
private fun DayBar(day: LocalDate, today: LocalDate, onSelectDay: (LocalDate) -> Unit, onMoveDay: (Long) -> Unit) {
    var picking by rememberSaveable { mutableStateOf(false) }
    val isToday = day == today
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp),
    ) {
        IconButton(onClick = { onMoveDay(-1) }) {
            Icon(painterResource(UiIcons.ChevronLeft), contentDescription = stringResource(R.string.tracker_previous_day))
        }
        TextButton(onClick = { picking = true }, modifier = Modifier.weight(1f)) {
            Text(
                text = if (isToday) stringResource(R.string.tracker_today) else day.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL)),
                style = MaterialTheme.typography.titleSmall,
                textAlign = TextAlign.Center,
            )
        }
        IconButton(onClick = { onMoveDay(1) }, enabled = !isToday) {
            Icon(painterResource(UiIcons.ChevronRight), contentDescription = stringResource(R.string.tracker_next_day))
        }
        Spacer(Modifier.size(4.dp))
        OutlinedIconButton(onClick = { onSelectDay(today) }, enabled = !isToday) {
            Icon(painterResource(UiIcons.CalendarSearch), contentDescription = stringResource(R.string.tracker_go_to_today))
        }
    }
    if (picking) {
        DayPickerDialog(
            day = day,
            today = today,
            onDismiss = { picking = false },
            onPick = {
                picking = false
                onSelectDay(it)
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DayPickerDialog(day: LocalDate, today: LocalDate, onDismiss: () -> Unit, onPick: (LocalDate) -> Unit) {
    // The picker speaks UTC midnights; only days up to today can be picked.
    val todayMillis = today.toUtcMillis()
    val pickerState = rememberDatePickerState(
        initialSelectedDateMillis = day.toUtcMillis(),
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long) = utcTimeMillis <= todayMillis
            override fun isSelectableYear(year: Int) = year <= today.year
        },
    )
    DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = { pickerState.selectedDateMillis?.let { onPick(it.toUtcDate()) } },
                enabled = pickerState.selectedDateMillis != null,
            ) { Text(stringResource(R.string.common_save)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.common_cancel)) }
        },
    ) {
        DatePicker(state = pickerState, title = {
            Text(
                text = stringResource(R.string.android_tracker_choose_day),
                modifier = Modifier.padding(start = 24.dp, end = 12.dp, top = 16.dp),
            )
        })
    }
}

@Composable
private fun OverflowMenu(onSignOut: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    IconButton(onClick = { open = true }) {
        Icon(painterResource(UiIcons.MoreVertical), contentDescription = stringResource(R.string.android_tracker_more_options))
    }
    DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
        DropdownMenuItem(
            text = { Text(stringResource(R.string.nav_log_out)) },
            onClick = {
                open = false
                onSignOut()
            },
        )
    }
}

@Composable
private fun CenteredText(@StringRes text: Int) {
    Text(
        text = stringResource(text),
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth().padding(32.dp),
    )
}

private fun LocalDate.toUtcMillis(): Long = atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()

private fun Long.toUtcDate(): LocalDate = Instant.ofEpochMilli(this).atZone(ZoneOffset.UTC).toLocalDate()

@get:StringRes
private val TrackerMessage.textRes: Int
    get() = when (this) {
        TrackerMessage.Offline -> R.string.android_tracker_offline
        TrackerMessage.SyncFailed -> R.string.errors_generic_title
        TrackerMessage.HabitFrozen -> R.string.errors_limits_habit_frozen_body
    }
