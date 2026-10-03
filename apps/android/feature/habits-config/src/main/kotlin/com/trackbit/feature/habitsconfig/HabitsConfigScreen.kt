package com.trackbit.feature.habitsconfig

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.designsystem.color.colorAt
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.designsystem.icon.painter
import com.trackbit.core.i18n.R
import com.trackbit.core.model.Habit
import com.trackbit.core.model.resolveColorStops
import sh.calvin.reorderable.ReorderableCollectionItemScope
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

/**
 * The habits config list (the web's `/config/habits`). [onEdit] opens the form for a habit,
 * [onAdd] for a new one.
 */
@Composable
fun HabitsConfigScreen(
    onBack: () -> Unit,
    onAdd: () -> Unit,
    onEdit: (habitId: Int) -> Unit,
    viewModel: HabitsConfigViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    // Also brings back the form's saves, and changes made on the web meanwhile.
    LifecycleResumeEffect(viewModel) {
        viewModel.refresh()
        onPauseOrDispose {}
    }

    state.message?.let { message ->
        val text = message.text()
        LaunchedEffect(message) {
            snackbar.showSnackbar(text)
            viewModel.onMessageShown(message)
        }
    }

    HabitsConfigContent(
        state = state,
        snackbar = snackbar,
        onBack = onBack,
        onAdd = { if (state.atHabitCap) viewModel.onAddAtCap() else onAdd() },
        onEdit = onEdit,
        onRefresh = viewModel::refresh,
        onMove = viewModel::move,
        onDrop = viewModel::drop,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HabitsConfigContent(
    state: HabitsConfigUiState,
    snackbar: SnackbarHostState,
    onBack: () -> Unit,
    onAdd: () -> Unit,
    onEdit: (Int) -> Unit,
    onRefresh: () -> Unit,
    onMove: (from: Any, to: Any) -> Unit,
    onDrop: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.habits_page_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(painterResource(UiIcons.ArrowLeft), stringResource(R.string.android_nav_back))
                    }
                },
            )
        },
        floatingActionButton = {
            if (state.rows != null) {
                ExtendedFloatingActionButton(
                    onClick = onAdd,
                    icon = { Icon(painterResource(UiIcons.Plus), contentDescription = null) },
                    text = { Text(stringResource(R.string.habits_list_add)) },
                    // At the cap it still answers (with the reason), so it only looks disabled.
                    modifier = Modifier.alpha(if (state.atHabitCap) DISABLED_ALPHA else 1f),
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.refreshing && state.rows != null,
            onRefresh = onRefresh,
            modifier = Modifier.padding(padding).fillMaxSize(),
        ) {
            when {
                state.rows != null -> HabitList(state.rows, onEdit, onMove, onDrop)
                state.loadFailed -> Column(
                    Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(stringResource(R.string.android_errors_offline), textAlign = TextAlign.Center)
                    TextButton(onClick = onRefresh) { Text(stringResource(R.string.android_retry)) }
                }
                else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(stringResource(R.string.habits_page_loading), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun HabitList(
    rows: List<HabitsConfigRow>,
    onEdit: (Int) -> Unit,
    onMove: (from: Any, to: Any) -> Unit,
    onDrop: () -> Unit,
) {
    val listState = rememberLazyListState()
    val reorderState = rememberReorderableLazyListState(listState) { from, to -> onMove(from.key, to.key) }
    val header = rows.indexOf(HabitsConfigRow.AntiHeader)

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        // Room for the add button over the last row.
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 88.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        // Outside the reorderable rows, so nothing can be dragged above it.
        item(key = "habits") {
            GroupHeader(R.string.habits_list_habits, header, anti = false)
            if (header == 0) EmptyGroup(R.string.habits_list_empty)
        }
        items(rows, key = { it.key }) { row ->
            ReorderableItem(reorderState, key = row.key) { isDragging ->
                when (row) {
                    // A plain row the dragged habit can pass, which is how it changes group.
                    HabitsConfigRow.AntiHeader -> Column(Modifier.padding(top = 16.dp)) {
                        GroupHeader(R.string.habits_list_anti_habits, rows.size - header - 1, anti = true)
                        if (header == rows.lastIndex) EmptyGroup(R.string.habits_list_drag_to_anti)
                    }
                    is HabitsConfigRow.Item -> HabitConfigRow(row.habit, isDragging, onEdit, onDrop)
                }
            }
        }
    }
}

@Composable
private fun GroupHeader(title: Int, count: Int, anti: Boolean) {
    val color = if (anti) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(vertical = 4.dp),
    ) {
        if (anti) Icon(painterResource(UiIcons.ShieldAlert), contentDescription = null, tint = color, modifier = Modifier.size(20.dp))
        Text(stringResource(title), style = MaterialTheme.typography.titleMedium, color = color, modifier = Modifier.weight(1f))
        Text(
            text = count.toString(),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier
                .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(50))
                .padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

@Composable
private fun EmptyGroup(text: Int) {
    Text(
        text = stringResource(text),
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
    )
}

@Composable
private fun ReorderableCollectionItemScope.HabitConfigRow(
    habit: Habit,
    isDragging: Boolean,
    onEdit: (Int) -> Unit,
    onDrop: () -> Unit,
) {
    val accent = resolveColorStops(habit.colorTheme, habit.colorStops).colorAt(1f)
    Card(
        onClick = { onEdit(habit.id) },
        modifier = Modifier.fillMaxWidth().then(if (isDragging) Modifier.shadow(8.dp, CardDefaults.shape) else Modifier),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(start = 12.dp, top = 12.dp, bottom = 12.dp).alpha(if (habit.frozen) DISABLED_ALPHA else 1f),
        ) {
            Box(
                Modifier.size(44.dp).background(accent, RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(habit.icon.painter(), contentDescription = null, tint = Color.White, modifier = Modifier.size(22.dp))
            }
            Column(Modifier.weight(1f).padding(horizontal = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    text = habit.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(
                    text = summary(habit),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (habit.frozen) {
                // Frozen habits keep their place: the server refuses to move them to the other group.
                Icon(
                    painterResource(UiIcons.Lock),
                    contentDescription = stringResource(R.string.errors_limits_frozen_badge),
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(12.dp).size(24.dp),
                )
            } else {
                IconButton(onClick = {}, modifier = Modifier.draggableHandle(onDragStopped = onDrop)) {
                    Icon(
                        painterResource(UiIcons.GripVertical),
                        contentDescription = stringResource(R.string.android_habits_reorder, habit.name),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

/** "Count • Daily Goal: 5/d • Weekly Goal: 7/w", as the web's list writes it. */
@Composable
private fun summary(habit: Habit): String {
    val daily = stringResource(if (habit.isAntiHabit) R.string.habits_list_daily_limit else R.string.habits_list_daily_goal)
    val weekly = stringResource(if (habit.isAntiHabit) R.string.habits_list_weekly_limit else R.string.habits_list_weekly_goal)
    return listOf(
        stringResource(habit.type.badgeRes),
        "$daily ${habit.dailyGoal}${stringResource(R.string.habits_list_per_day)}",
        "$weekly ${habit.weeklyGoal}${stringResource(R.string.habits_list_per_week)}",
    ).joinToString(" • ")
}

@Composable
private fun HabitsConfigMessage.text(): String = when (this) {
    HabitsConfigMessage.Offline -> stringResource(R.string.android_errors_offline)
    HabitsConfigMessage.Failed -> stringResource(R.string.errors_generic_title)
    HabitsConfigMessage.HabitFrozen -> stringResource(R.string.errors_limits_habit_frozen_body)
    HabitsConfigMessage.StructuredAntiHabit -> stringResource(R.string.habits_list_error_anti_restriction)
    is HabitsConfigMessage.HabitLimitReached -> stringResource(R.string.errors_limits_habit_limit_reached_body, maxHabits)
}

internal const val DISABLED_ALPHA = 0.5f
