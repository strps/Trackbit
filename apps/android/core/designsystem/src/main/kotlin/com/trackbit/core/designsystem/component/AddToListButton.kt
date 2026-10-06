package com.trackbit.core.designsystem.component

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.ExerciseList

/** A list an exercise can be appended to (frozen lists aren't offered). */
data class ListTarget(val uuid: String, val name: String, val itemCount: Int, val contains: Boolean)

/** What the menu shows: the lists once loaded, or why they aren't. */
sealed interface ListTargets {
    data object Loading : ListTargets
    data object Offline : ListTargets
    data class Loaded(val lists: List<ListTarget>) : ListTargets

    companion object {
        /** The unfrozen ones of [lists] (null until loaded; [failed] when that failed) for [exerciseUuid]. */
        fun of(lists: List<ExerciseList>?, failed: Boolean, exerciseUuid: String): ListTargets = when {
            lists != null -> Loaded(
                lists.filterNot { it.frozen }.map { list ->
                    ListTarget(list.uuid, list.name, list.items.size, contains = list.items.any { it.exerciseUuid == exerciseUuid })
                },
            )
            failed -> Offline
            else -> Loading
        }
    }
}

/**
 * The web's `AddToListMenu`: a button that lists the user's lists and appends the exercise to the
 * one picked. A list already holding it shows a check and can't be picked again from here.
 * [onOpen] runs when the menu opens, so the caller can load the lists.
 */
@Composable
fun AddToListButton(targets: ListTargets, onOpen: () -> Unit, onPick: (ListTarget) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    val label = stringResource(R.string.lists_add_to_list_label)
    Box(modifier) {
        IconButton(onClick = {
            open = true
            onOpen()
        }) {
            Icon(painterResource(UiIcons.ListPlus), label, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            Text(
                label,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
            HorizontalDivider()
            when (targets) {
                ListTargets.Loading -> DropdownMenuItem(text = { Text(stringResource(R.string.lists_page_loading)) }, enabled = false, onClick = {})
                ListTargets.Offline -> DropdownMenuItem(text = { Text(stringResource(R.string.android_errors_offline)) }, enabled = false, onClick = {})
                is ListTargets.Loaded -> {
                    if (targets.lists.isEmpty()) {
                        DropdownMenuItem(text = { Text(stringResource(R.string.lists_add_to_list_empty)) }, enabled = false, onClick = {})
                    }
                    for (target in targets.lists) {
                        DropdownMenuItem(
                            text = { Text(target.name, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                            trailingIcon = {
                                if (target.contains) {
                                    Icon(painterResource(UiIcons.Check), stringResource(R.string.lists_add_to_list_in_list), Modifier.size(16.dp))
                                } else {
                                    Text(target.itemCount.toString(), style = MaterialTheme.typography.labelSmall)
                                }
                            },
                            enabled = !target.contains,
                            onClick = {
                                open = false
                                onPick(target)
                            },
                        )
                    }
                }
            }
        }
    }
}
