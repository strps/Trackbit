package com.trackbit.feature.exerciselists

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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
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
import com.trackbit.core.model.ExerciseList
import sh.calvin.reorderable.ReorderableCollectionItemScope
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

/** The user's exercise lists (the web's `/config/lists`). [onOpen] opens a list's editor. */
@Composable
fun ExerciseListsScreen(
    onBack: () -> Unit,
    onOpen: (listUuid: String) -> Unit,
    viewModel: ExerciseListsViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    // Also brings back the editor's changes, and changes made on the web meanwhile.
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

    // A new list opens straight away, as the web selects it.
    state.created?.let { uuid ->
        LaunchedEffect(uuid) {
            viewModel.onCreatedOpened()
            onOpen(uuid)
        }
    }

    state.creating?.let { form ->
        ListFormDialog(
            form = form,
            isNew = true,
            busy = state.busy,
            onEdit = viewModel::editCreate,
            onDismiss = viewModel::cancelCreate,
            onSubmit = viewModel::create,
        )
    }

    ExerciseListsContent(
        state = state,
        snackbar = snackbar,
        onBack = onBack,
        onAdd = viewModel::startCreate,
        onOpen = onOpen,
        onRefresh = viewModel::refresh,
        onMove = viewModel::move,
        onDrop = viewModel::drop,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExerciseListsContent(
    state: ExerciseListsUiState,
    snackbar: SnackbarHostState,
    onBack: () -> Unit,
    onAdd: () -> Unit,
    onOpen: (String) -> Unit,
    onRefresh: () -> Unit,
    onMove: (from: String, to: String) -> Unit,
    onDrop: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.lists_page_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(painterResource(UiIcons.ArrowLeft), stringResource(R.string.android_nav_back))
                    }
                },
            )
        },
        floatingActionButton = {
            if (state.lists != null) {
                ExtendedFloatingActionButton(
                    onClick = onAdd,
                    icon = { Icon(painterResource(UiIcons.Plus), contentDescription = null) },
                    text = { Text(stringResource(R.string.lists_list_new)) },
                    // At the cap it still answers (with the reason), so it only looks disabled.
                    modifier = Modifier.alpha(if (state.atListCap) DISABLED_ALPHA else 1f),
                )
            }
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.refreshing && state.lists != null,
            onRefresh = onRefresh,
            modifier = Modifier.padding(padding).fillMaxSize(),
        ) {
            when {
                state.lists != null -> Lists(state.lists, onOpen, onMove, onDrop)
                state.loadFailed -> Column(
                    Modifier.fillMaxSize().padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(stringResource(R.string.android_errors_offline), textAlign = TextAlign.Center)
                    TextButton(onClick = onRefresh) { Text(stringResource(R.string.android_retry)) }
                }
                else -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(stringResource(R.string.lists_page_loading), color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}

@Composable
private fun Lists(
    lists: List<ExerciseList>,
    onOpen: (String) -> Unit,
    onMove: (from: String, to: String) -> Unit,
    onDrop: () -> Unit,
) {
    val listState = rememberLazyListState()
    val reorderState = rememberReorderableLazyListState(listState) { from, to -> onMove(from.key as String, to.key as String) }

    LazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        // Room for the add button over the last row.
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 88.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item(key = "subtitle") {
            Text(
                stringResource(R.string.lists_page_subtitle),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 8.dp),
            )
            if (lists.isEmpty()) {
                Column(Modifier.fillMaxWidth().padding(vertical = 32.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(stringResource(R.string.lists_list_empty_title), style = MaterialTheme.typography.titleMedium)
                    Text(
                        stringResource(R.string.lists_list_empty_desc),
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        textAlign = TextAlign.Center,
                    )
                }
            }
        }
        items(lists, key = { it.uuid }) { list ->
            ReorderableItem(reorderState, key = list.uuid) { isDragging ->
                ListRow(list, isDragging, onOpen, onDrop)
            }
        }
    }
}

@Composable
private fun ReorderableCollectionItemScope.ListRow(
    list: ExerciseList,
    isDragging: Boolean,
    onOpen: (String) -> Unit,
    onDrop: () -> Unit,
) {
    Card(
        onClick = { onOpen(list.uuid) },
        modifier = Modifier.fillMaxWidth().then(if (isDragging) Modifier.shadow(8.dp, CardDefaults.shape) else Modifier),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(start = 16.dp, top = 12.dp, bottom = 12.dp).alpha(if (list.frozen) DISABLED_ALPHA else 1f),
        ) {
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    list.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                list.description?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                Text(
                    pluralStringResource(R.plurals.lists_list_items_count, list.items.size, list.items.size),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (list.frozen) {
                // Frozen lists stay at the end, where the freeze put them (the server refuses a move).
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
                        contentDescription = stringResource(R.string.android_lists_reorder, list.name),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}

internal const val DISABLED_ALPHA = 0.5f
