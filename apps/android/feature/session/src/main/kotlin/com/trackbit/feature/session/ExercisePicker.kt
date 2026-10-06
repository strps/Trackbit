package com.trackbit.feature.session

import androidx.annotation.StringRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.trackbit.core.designsystem.component.AddToListButton
import com.trackbit.core.designsystem.component.ListTargets
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.QueueEmptyReason

/**
 * The foot of a session panel, like the web's picker: the source dropdown, the trigger that names
 * what Play adds (tap it for the list), and Play, which adds it. With a source, repeated Plays
 * walk its queue; in browse mode Play repeats the last pick.
 */
@Composable
internal fun ExercisePickerBar(
    picker: ExercisePickerState,
    sources: List<ExerciseSourceDescriptor>,
    sourcesLoaded: Boolean,
    onSelectSource: (key: String?) -> Unit,
    onOpenLists: () -> Unit,
    onOpenList: () -> Unit,
    onAdd: (exerciseUuid: String, listItemUuid: String?) -> Unit,
    modifier: Modifier = Modifier,
) {
    val selected = picker.selected
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        SourceDropdown(picker, sources, sourcesLoaded, onSelectSource, onOpenLists)
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = onOpenList, modifier = Modifier.weight(1f)) {
                Text(
                    text = selected?.name ?: stringResource(R.string.tracker_activity_select_exercise),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Icon(painterResource(UiIcons.ChevronDown), null, Modifier.padding(start = 8.dp).size(16.dp))
            }
            Spacer(Modifier.width(12.dp))
            val playLabel = when {
                selected == null -> stringResource(R.string.tracker_activity_select_exercise)
                picker.browsing -> stringResource(R.string.tracker_activity_add_selected, selected.name)
                else -> stringResource(R.string.tracker_activity_add_next_from, sourceName(picker.source))
            }
            FilledIconButton(
                onClick = {
                    val next = picker.nextEntry
                    if (next != null) onAdd(next.exerciseUuid, next.listItemUuid) else if (selected != null) onAdd(selected.uuid, null)
                },
                // A frozen custom exercise can't be logged; the server would refuse it.
                enabled = selected != null && !selected.frozen,
                modifier = Modifier.size(56.dp),
            ) {
                Icon(painterResource(UiIcons.Play), playLabel)
            }
        }
    }
}

/** "All exercises" (browse mode, the absence of a source) above the user's sources. */
@Composable
private fun SourceDropdown(
    picker: ExercisePickerState,
    sources: List<ExerciseSourceDescriptor>,
    sourcesLoaded: Boolean,
    onSelect: (key: String?) -> Unit,
    onOpenLists: () -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    fun select(key: String?) {
        open = false
        onSelect(key)
    }
    Box {
        TextButton(onClick = { open = true }, contentPadding = PaddingValues(horizontal = 8.dp)) {
            Icon(painterResource(UiIcons.Layers), null, Modifier.size(14.dp))
            Spacer(Modifier.width(6.dp))
            Text(
                sourceName(picker.source),
                style = MaterialTheme.typography.labelMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.widthIn(max = 220.dp),
            )
            Icon(painterResource(UiIcons.ChevronDown), null, Modifier.padding(start = 4.dp).size(14.dp))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Text(
                stringResource(R.string.tracker_activity_source),
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
            HorizontalDivider()
            DropdownMenuItem(
                text = { Text(stringResource(R.string.tracker_activity_all_exercises)) },
                leadingIcon = { CheckMark(picker.browsing) },
                onClick = { select(null) },
            )
            // Lists are the only sources a user makes today, so none means no lists: the hint
            // opens the lists screen, as the web's links to /config/lists.
            if (sourcesLoaded && sources.isEmpty()) {
                HorizontalDivider()
                DropdownMenuItem(
                    text = { Text(stringResource(R.string.tracker_activity_no_lists_hint)) },
                    leadingIcon = { Icon(painterResource(UiIcons.Plus), null, Modifier.size(18.dp)) },
                    onClick = {
                        open = false
                        onOpenLists()
                    },
                )
            }
            for (source in sources) {
                DropdownMenuItem(
                    text = { Text(sourceName(source), maxLines = 1, overflow = TextOverflow.Ellipsis) },
                    leadingIcon = { CheckMark(picker.source?.key == source.key) },
                    trailingIcon = source.itemCount?.let { count ->
                        {
                            Text(
                                count.toString(),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    },
                    onClick = { select(source.key) },
                )
            }
        }
    }
}

@Composable
private fun CheckMark(checked: Boolean) {
    Icon(painterResource(UiIcons.Check), null, Modifier.size(18.dp).alpha(if (checked) 1f else 0f))
}

/**
 * The picker's list: the source's queue (the cursor marked, done entries dimmed), or the catalog
 * when browsing or searching. Picking adds the exercise, as a queue entry when it stands for one.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ExercisePickerSheet(
    picker: ExercisePickerState,
    listTargets: (exerciseUuid: String) -> ListTargets,
    onListsMenu: () -> Unit,
    onAddToList: (listUuid: String, exerciseUuid: String) -> Unit,
    onDismiss: () -> Unit,
    onPick: (exerciseUuid: String, listItemUuid: String?) -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    val searching = query.isNotBlank()
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Text(
            stringResource(R.string.tracker_activity_select_exercise),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(horizontal = 24.dp),
        )
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text(stringResource(R.string.tracker_activity_search_exercises)) },
            leadingIcon = { Icon(painterResource(UiIcons.Search), null, Modifier.size(18.dp)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        )
        LazyColumn(contentPadding = PaddingValues(bottom = 32.dp)) {
            if (!picker.browsing && !searching) {
                val rows = picker.queueRows
                when {
                    picker.queueLoading -> item { SheetText(R.string.tracker_activity_loading) }
                    // An empty source says why, instead of offering nothing.
                    picker.entries.isEmpty() -> item { SheetText(picker.emptyReason.textRes) }
                    else -> item {
                        Text(
                            sourceName(picker.source).uppercase(),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 24.dp, vertical = 4.dp),
                        )
                    }
                }
                // A routine may hold an exercise twice, so rows are keyed by their place in it.
                itemsIndexed(rows, key = { i, _ -> "entry-$i" }) { _, row ->
                    PickerRowItem(row, listTargets(row.exercise.uuid), onListsMenu, onAddToList, onPick)
                }
            } else {
                val rows = picker.search(query)
                if (rows.isEmpty()) item { SheetText(R.string.tracker_activity_no_exercises_found) }
                items(rows, key = { it.exercise.uuid }) { row ->
                    PickerRowItem(row, listTargets(row.exercise.uuid), onListsMenu, onAddToList, onPick)
                }
            }
        }
    }
}

@Composable
private fun PickerRowItem(
    row: PickerRow,
    listTargets: ListTargets,
    onListsMenu: () -> Unit,
    onAddToList: (listUuid: String, exerciseUuid: String) -> Unit,
    onPick: (exerciseUuid: String, listItemUuid: String?) -> Unit,
) {
    val exercise = row.exercise
    ListItem(
        headlineContent = { Text(exercise.name) },
        supportingContent = { Text(exercise.category.uppercase(), style = MaterialTheme.typography.labelSmall) },
        trailingContent = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                AddToListButton(listTargets, onListsMenu, onPick = { onAddToList(it.uuid, exercise.uuid) })
                RowMark(exercise, row.done)
            }
        },
        // The cursor: what Play adds next.
        colors = if (row.highlighted) {
            ListItemDefaults.colors(containerColor = MaterialTheme.colorScheme.secondaryContainer)
        } else {
            ListItemDefaults.colors()
        },
        modifier = Modifier
            .alpha(if (row.done) 0.5f else 1f)
            .clickable(enabled = !exercise.frozen) { onPick(exercise.uuid, row.entry?.listItemUuid) },
    )
}

@Composable
private fun RowMark(exercise: Exercise, done: Boolean) {
    val modifier = Modifier.size(18.dp)
    when {
        exercise.frozen -> Icon(painterResource(UiIcons.Lock), stringResource(R.string.errors_limits_custom_exercise_frozen_title), modifier)
        done -> Icon(painterResource(UiIcons.Check), null, modifier)
        else -> Icon(painterResource(UiIcons.Plus), null, modifier)
    }
}

@Composable
private fun SheetText(@StringRes text: Int) {
    Text(
        text = stringResource(text),
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth().padding(24.dp),
    )
}

/**
 * A source's name: user content, never translated. Null is browse mode. No source is
 * system-named yet; when one is (programs' "today's routine"), its `nameKey` maps here.
 */
@Composable
private fun sourceName(source: ExerciseSourceDescriptor?): String = when {
    source == null -> stringResource(R.string.tracker_activity_all_exercises)
    else -> source.name ?: stringResource(R.string.tracker_activity_source)
}

@get:StringRes
private val QueueEmptyReason?.textRes: Int
    get() = when (this) {
        QueueEmptyReason.RestDay -> R.string.tracker_activity_source_empty_rest_day
        QueueEmptyReason.NoRoutineScheduled -> R.string.tracker_activity_source_empty_no_routine
        QueueEmptyReason.ListEmpty -> R.string.tracker_activity_source_empty_list
        QueueEmptyReason.NoData, QueueEmptyReason.Unknown, null -> R.string.tracker_activity_source_empty_no_data
    }
