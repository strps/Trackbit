package com.trackbit.feature.exerciselibrary

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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseCategory

/**
 * The exercise library (the web's `/config/exercises`). [onEdit] opens the form for one of the
 * user's own exercises, [onAdd] for a new one; system exercises are read-only.
 */
@Composable
fun ExerciseLibraryScreen(
    onBack: () -> Unit,
    onAdd: () -> Unit,
    onEdit: (exerciseId: Int) -> Unit,
    viewModel: ExerciseLibraryViewModel = hiltViewModel(),
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

    ExerciseLibraryContent(
        state = state,
        snackbar = snackbar,
        onBack = onBack,
        onAdd = { if (state.atExerciseCap) viewModel.onAddAtCap() else onAdd() },
        onEdit = onEdit,
        onRefresh = viewModel::refresh,
        onSearch = viewModel::search,
        onOwner = viewModel::filterOwner,
        onMuscleGroup = viewModel::filterMuscleGroup,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExerciseLibraryContent(
    state: ExerciseLibraryUiState,
    snackbar: SnackbarHostState,
    onBack: () -> Unit,
    onAdd: () -> Unit,
    onEdit: (Int) -> Unit,
    onRefresh: () -> Unit,
    onSearch: (String) -> Unit,
    onOwner: (OwnerFilter) -> Unit,
    onMuscleGroup: (Int?) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.exercises_page_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(painterResource(UiIcons.ArrowLeft), stringResource(R.string.android_nav_back))
                    }
                },
            )
        },
        floatingActionButton = {
            if (state.exercises != null) {
                ExtendedFloatingActionButton(
                    onClick = onAdd,
                    icon = { Icon(painterResource(UiIcons.Plus), contentDescription = null) },
                    text = { Text(stringResource(R.string.exercises_page_add)) },
                    // At the cap it still answers (with the reason), so it only looks disabled.
                    modifier = Modifier.alpha(if (state.atExerciseCap) DISABLED_ALPHA else 1f),
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.refreshing && state.exercises != null,
            onRefresh = onRefresh,
            modifier = Modifier.padding(padding).fillMaxSize(),
        ) {
            when {
                state.exercises != null -> ExerciseList(state, onEdit, onSearch, onOwner, onMuscleGroup)
                state.loadFailed -> Column(
                    Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(stringResource(R.string.android_errors_offline), textAlign = TextAlign.Center)
                    TextButton(onClick = onRefresh) { Text(stringResource(R.string.android_retry)) }
                }
                else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(stringResource(R.string.exercises_page_loading), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExerciseList(
    state: ExerciseLibraryUiState,
    onEdit: (Int) -> Unit,
    onSearch: (String) -> Unit,
    onOwner: (OwnerFilter) -> Unit,
    onMuscleGroup: (Int?) -> Unit,
) {
    val visible = state.visible
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        // Room for the add button over the last row.
        contentPadding = PaddingValues(top = 8.dp, bottom = 88.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(key = "search") {
            OutlinedTextField(
                value = state.query,
                onValueChange = onSearch,
                placeholder = { Text(stringResource(R.string.exercises_page_search)) },
                leadingIcon = { Icon(painterResource(UiIcons.Search), contentDescription = null) },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            )
        }
        item(key = "owner") {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(horizontal = 16.dp)) {
                OwnerFilter.entries.forEachIndexed { i, owner ->
                    SegmentedButton(
                        selected = state.owner == owner,
                        onClick = { onOwner(owner) },
                        shape = SegmentedButtonDefaults.itemShape(i, OwnerFilter.entries.size),
                    ) { Text(stringResource(owner.labelRes)) }
                }
            }
        }
        if (state.filterGroups.isNotEmpty()) {
            item(key = "muscles") {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    item {
                        FilterChip(
                            selected = state.muscleGroupId == null,
                            onClick = { onMuscleGroup(null) },
                            label = { Text(stringResource(R.string.android_exercises_all_muscles)) },
                        )
                    }
                    items(state.filterGroups, key = { it.id }) { group ->
                        FilterChip(
                            selected = state.muscleGroupId == group.id,
                            onClick = { onMuscleGroup(if (state.muscleGroupId == group.id) null else group.id) },
                            label = { Text(group.name) },
                        )
                    }
                }
            }
        }
        if (visible.isEmpty()) {
            item(key = "empty") {
                Text(
                    text = stringResource(R.string.exercises_page_empty),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                )
            }
        }
        items(visible, key = { it.id }) { exercise ->
            ExerciseRow(exercise, onEdit, Modifier.padding(horizontal = 16.dp))
        }
    }
}

@Composable
private fun ExerciseRow(exercise: Exercise, onEdit: (Int) -> Unit, modifier: Modifier) {
    val category = ExerciseCategory.of(exercise.category)
    val mine = exercise.userId != null
    val content: @Composable () -> Unit = {
        Column(
            Modifier.padding(12.dp).alpha(if (exercise.frozen) DISABLED_ALPHA else 1f),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                CategoryBadge(category)
                Box(Modifier.weight(1f))
                if (exercise.frozen) Badge(UiIcons.Lock, stringResource(R.string.errors_limits_frozen_badge))
                if (mine) {
                    Badge(UiIcons.User, stringResource(R.string.exercises_badge_mine))
                } else {
                    Badge(null, stringResource(R.string.exercises_badge_system))
                }
            }
            Text(
                exercise.name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            exercise.description?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(
                    painterResource(UiIcons.Activity),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    exercise.muscleGroups.joinToString(", ") { it.name }.ifEmpty { stringResource(R.string.exercises_card_general) },
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
    // Only the user's own open the form; a frozen one opens read-only (it can still be deleted).
    if (mine) {
        Card(onClick = { onEdit(exercise.id) }, modifier = modifier.fillMaxWidth()) { content() }
    } else {
        Card(modifier = modifier.fillMaxWidth()) { content() }
    }
}

@Composable
internal fun CategoryBadge(category: ExerciseCategory) {
    val (background, foreground) = category.badgeColors()
    Text(
        stringResource(category.labelRes),
        style = MaterialTheme.typography.labelSmall,
        color = foreground,
        modifier = Modifier.background(background, RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

@Composable
private fun Badge(icon: Int?, label: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier
            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(6.dp))
            .padding(horizontal = 6.dp, vertical = 2.dp),
    ) {
        if (icon != null) {
            Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(12.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

private val OwnerFilter.labelRes: Int
    get() = when (this) {
        OwnerFilter.All -> R.string.exercises_filter_all
        OwnerFilter.Custom -> R.string.exercises_filter_custom
        OwnerFilter.System -> R.string.exercises_filter_system
    }

@Composable
private fun ExerciseLibraryMessage.text(): String = when (this) {
    ExerciseLibraryMessage.Offline -> stringResource(R.string.android_errors_offline)
    ExerciseLibraryMessage.Failed -> stringResource(R.string.exercises_page_error)
    is ExerciseLibraryMessage.LimitReached -> stringResource(R.string.exercises_page_at_cap, maxCustomExercises)
}

internal const val DISABLED_ALPHA = 0.5f
