package com.trackbit.feature.exerciselists

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.designsystem.format.formatDuration
import com.trackbit.core.designsystem.format.formatNumber
import com.trackbit.core.designsystem.format.kgToDisplay
import com.trackbit.core.designsystem.format.weightUnit
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseListItem
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.model.prescription
import sh.calvin.reorderable.ReorderableCollectionItemScope
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

/** One list's editor: its exercises in order, each with optional targets. [onDone] closes it. */
@Composable
fun ListEditorScreen(onDone: () -> Unit, viewModel: ListEditorViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.done) { if (state.done) onDone() }

    state.message?.let { message ->
        val text = message.text()
        LaunchedEffect(message) {
            snackbar.showSnackbar(text)
            viewModel.onMessageShown(message)
        }
    }

    state.renaming?.let { form ->
        ListFormDialog(
            form = form,
            isNew = false,
            busy = state.busy,
            onEdit = viewModel::editRename,
            onDismiss = viewModel::cancelRename,
            onSubmit = viewModel::rename,
        )
    }
    if (state.confirmingDelete) {
        val name = state.list?.name.orEmpty()
        AlertDialog(
            onDismissRequest = { viewModel.confirmDelete(false) },
            title = { Text(stringResource(R.string.lists_delete_title, name)) },
            text = { Text(stringResource(R.string.lists_delete_body)) },
            confirmButton = {
                TextButton(onClick = viewModel::delete) {
                    Text(stringResource(R.string.lists_delete_confirm), color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { viewModel.confirmDelete(false) }) { Text(stringResource(R.string.lists_delete_cancel)) }
            },
        )
    }
    if (state.adding) {
        AddExerciseSheet(state, onDismiss = viewModel::stopAdding, onAdd = viewModel::add)
    }
    state.editingItem?.let { itemId ->
        val item = state.items.find { it.id == itemId }
        if (item != null) {
            TargetsSheet(
                exerciseName = state.exercise(item.exerciseId)?.name ?: stringResource(R.string.tracker_activity_unknown_exercise),
                category = ExerciseCategory.of(state.exercise(item.exerciseId)?.category),
                initial = item.prescription,
                units = state.units,
                onDismiss = viewModel::stopEditingTargets,
                onSave = { viewModel.saveTargets(itemId, it) },
            )
        }
    }

    ListEditorContent(
        state = state,
        snackbar = snackbar,
        onBack = onDone,
        onRetry = viewModel::load,
        onRename = viewModel::startRename,
        onDelete = { viewModel.confirmDelete(true) },
        onAdd = viewModel::startAdding,
        onEditTargets = viewModel::editTargets,
        onRemove = viewModel::remove,
        onMove = viewModel::move,
        onDrop = viewModel::drop,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ListEditorContent(
    state: ListEditorUiState,
    snackbar: SnackbarHostState,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onRename: () -> Unit,
    onDelete: () -> Unit,
    onAdd: () -> Unit,
    onEditTargets: (Int) -> Unit,
    onRemove: (Int) -> Unit,
    onMove: (from: Int, to: Int) -> Unit,
    onDrop: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(state.list?.name.orEmpty(), maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(painterResource(UiIcons.ArrowLeft), stringResource(R.string.android_nav_back))
                    }
                },
                actions = {
                    if (state.editable) {
                        IconButton(onClick = onRename) {
                            Icon(painterResource(UiIcons.Pencil), stringResource(R.string.lists_list_rename))
                        }
                    }
                    // A frozen list can still be deleted: that's how the user frees a slot.
                    if (state.list != null) {
                        IconButton(onClick = onDelete, enabled = !state.busy) {
                            Icon(painterResource(UiIcons.Trash), stringResource(R.string.lists_list_delete))
                        }
                    }
                },
            )
        },
        floatingActionButton = {
            if (state.editable) {
                ExtendedFloatingActionButton(
                    onClick = onAdd,
                    icon = { Icon(painterResource(UiIcons.Plus), contentDescription = null) },
                    text = { Text(stringResource(R.string.lists_editor_add_exercise)) },
                    modifier = Modifier.alpha(if (state.atItemCap) DISABLED_ALPHA else 1f),
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when {
                state.list != null -> Items(state, onEditTargets, onRemove, onMove, onDrop)
                state.loadFailed -> Column(
                    Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(stringResource(R.string.android_errors_offline), textAlign = TextAlign.Center)
                    TextButton(onClick = onRetry) { Text(stringResource(R.string.android_retry)) }
                }
                else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(stringResource(R.string.lists_page_loading), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun Items(
    state: ListEditorUiState,
    onEditTargets: (Int) -> Unit,
    onRemove: (Int) -> Unit,
    onMove: (from: Int, to: Int) -> Unit,
    onDrop: () -> Unit,
) {
    val listState = rememberLazyListState()
    val reorderState = rememberReorderableLazyListState(listState) { from, to -> onMove(from.key as Int, to.key as Int) }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        // Room for the add button over the last row.
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 88.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(key = "header") {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 4.dp)) {
                state.list?.description?.let {
                    Text(it, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                if (state.frozen) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
                            .padding(12.dp),
                    ) {
                        Icon(painterResource(UiIcons.Lock), null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(
                            stringResource(R.string.lists_editor_frozen_note),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
                if (state.items.isEmpty()) {
                    Text(
                        stringResource(R.string.lists_editor_empty),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                    )
                }
            }
        }
        items(state.items, key = { it.id }) { item ->
            ReorderableItem(reorderState, key = item.id, enabled = state.editable) { isDragging ->
                ItemRow(
                    item = item,
                    number = state.items.indexOf(item) + 1,
                    exercise = state.exercise(item.exerciseId),
                    units = state.units,
                    editable = state.editable,
                    isDragging = isDragging,
                    onEditTargets = onEditTargets,
                    onRemove = onRemove,
                    onDrop = onDrop,
                )
            }
        }
    }
}

@Composable
private fun ReorderableCollectionItemScope.ItemRow(
    item: ExerciseListItem,
    number: Int,
    exercise: Exercise?,
    units: UnitSystem,
    editable: Boolean,
    isDragging: Boolean,
    onEditTargets: (Int) -> Unit,
    onRemove: (Int) -> Unit,
    onDrop: () -> Unit,
) {
    val name = exercise?.name ?: stringResource(R.string.tracker_activity_unknown_exercise)
    Card(
        onClick = { onEditTargets(item.id) },
        enabled = editable,
        modifier = Modifier.fillMaxWidth().then(if (isDragging) Modifier.shadow(8.dp, CardDefaults.shape) else Modifier),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.alpha(if (editable) 1f else DISABLED_ALPHA)) {
            if (editable) {
                IconButton(onClick = {}, modifier = Modifier.draggableHandle(onDragStopped = onDrop)) {
                    Icon(
                        painterResource(UiIcons.GripVertical),
                        contentDescription = stringResource(R.string.android_lists_reorder, name),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            } else {
                Box(Modifier.width(16.dp))
            }
            Text(
                number.toString(),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.width(24.dp),
            )
            Column(Modifier.weight(1f).padding(vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                exercise?.let {
                    Text(
                        it.category.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                val targets = targetsSummary(item, units)
                Text(
                    targets ?: stringResource(R.string.android_lists_targets_set),
                    style = MaterialTheme.typography.bodySmall,
                    color = if (targets != null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                )
                item.notes?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodySmall,
                        fontStyle = FontStyle.Italic,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            if (editable) {
                IconButton(onClick = { onRemove(item.id) }) {
                    Icon(painterResource(UiIcons.X), stringResource(R.string.lists_editor_remove), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

/** "3 × 8 · 60 kg · Rest 1:30", or null when nothing is prescribed (notes show apart). */
@Composable
private fun targetsSummary(item: ExerciseListItem, units: UnitSystem): String? {
    val parts = buildList {
        when {
            item.targetSets != null && item.targetReps != null -> add("${item.targetSets} × ${item.targetReps}")
            item.targetSets != null -> add("${stringResource(R.string.exercises_field_sets)} ${item.targetSets}")
            item.targetReps != null -> add("${stringResource(R.string.exercises_field_reps)} ${item.targetReps}")
        }
        item.targetWeight?.let { add("${formatNumber(kgToDisplay(it, units))} ${weightUnit(units)}") }
        item.targetDistance?.let { add("${formatNumber(it)} km") }
        item.targetDuration?.let { add(formatDuration(it * 1000L)) }
        item.restSeconds?.let { add(stringResource(R.string.android_rest_default, formatDuration(it * 1000L))) }
    }
    return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
}

/** Picks an exercise to append, like the web editor's popover. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddExerciseSheet(state: ListEditorUiState, onDismiss: () -> Unit, onAdd: (Int) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    val inList = state.items.mapTo(HashSet()) { it.exerciseId }
    val visible = state.exercises.filter { query.isBlank() || it.name.contains(query.trim(), ignoreCase = true) }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Text(
            stringResource(R.string.lists_editor_add_exercise),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(horizontal = 24.dp),
        )
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text(stringResource(R.string.lists_editor_search)) },
            leadingIcon = { Icon(painterResource(UiIcons.Search), null, Modifier.size(18.dp)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        )
        LazyColumn(contentPadding = PaddingValues(bottom = 32.dp)) {
            if (visible.isEmpty()) {
                item {
                    Text(
                        stringResource(R.string.lists_editor_no_results),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp),
                    )
                }
            }
            items(visible, key = { it.id }) { exercise ->
                val added = exercise.id in inList
                ListItem(
                    headlineContent = { Text(exercise.name) },
                    supportingContent = { Text(exercise.category.uppercase(), style = MaterialTheme.typography.labelSmall) },
                    // Already in the list can still be added again (a top set, then a backoff), as on the web.
                    trailingContent = {
                        Icon(
                            painterResource(if (added) UiIcons.Check else UiIcons.Plus),
                            contentDescription = if (added) stringResource(R.string.lists_editor_already_added) else null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(18.dp),
                        )
                    },
                    modifier = Modifier.clickable { onAdd(exercise.id) },
                )
            }
        }
    }
}
