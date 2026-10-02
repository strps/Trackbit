package com.trackbit.feature.session

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.trackbit.core.data.TrackedExerciseLog
import com.trackbit.core.data.TrackedSet
import com.trackbit.core.designsystem.format.formatDuration
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.SetValues
import com.trackbit.core.model.UnitSystem

/** What a log card can do to its log and sets. */
internal class LogCardActions(
    val onAddSet: (logId: String) -> Unit,
    val onUpdateSet: (setId: String, SetValues) -> Unit,
    val onDeleteSet: (setId: String) -> Unit,
    val onRemove: (logId: String) -> Unit,
)

/**
 * The classic card (the web's ExerciseLogCard): a summary of the sets, and while the log is
 * [selected] ("Start"), a card per set to edit it, plus "New set".
 */
@Composable
internal fun ExerciseLogCard(
    log: TrackedExerciseLog,
    exercise: Exercise?,
    units: UnitSystem,
    selected: Boolean,
    onSelect: (Boolean) -> Unit,
    enabled: Boolean,
    actions: LogCardActions,
) {
    val kind = ExerciseKind.of(exercise)
    var selectedSetId by rememberSaveable(log.id) { mutableStateOf<String?>(null) }
    val selectedSet = log.sets.find { it.id == selectedSetId }

    LogCardFrame(selected) {
        LogHeader(
            name = exercise?.name,
            menu = { close ->
                RemoveExerciseItem(log, actions, close)
                if (selected && kind != ExerciseKind.Flexibility) {
                    DropdownMenuItem(
                        text = { Text(stringResource(deleteSetLabel(kind))) },
                        leadingIcon = { Icon(painterResource(UiIcons.Trash), null, Modifier.size(18.dp)) },
                        enabled = enabled && selectedSet != null,
                        onClick = {
                            close()
                            selectedSet?.let { actions.onDeleteSet(it.id) }
                        },
                    )
                }
            },
            enabled = enabled,
        ) {
            if (selected) {
                FilledTonalButton(onClick = { onSelect(false) }) {
                    Icon(painterResource(UiIcons.Stop), null, Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(R.string.tracker_activity_finish))
                }
            } else {
                TextButton(onClick = { onSelect(true) }) {
                    Icon(painterResource(UiIcons.Play), null, Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(R.string.tracker_activity_start))
                }
            }
        }
        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            if (kind == ExerciseKind.Flexibility) HoldSummary(log) else SetsLegend(kind, log.sets, units)
        }
        AnimatedVisibility(selected) {
            Column {
                HorizontalDivider()
                if (kind == ExerciseKind.Flexibility) {
                    HoldEditor(log, units, enabled, actions)
                } else {
                    SetCards(log, kind, units, selectedSetId, { selectedSetId = it }, enabled, actions)
                }
            }
        }
    }
}

/**
 * The compact card (the web's ExerciseLogCardCompact): the summary's set columns are the
 * controls. Tapping one opens its editor; "+" adds a set and opens it.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun ExerciseLogCardCompact(
    log: TrackedExerciseLog,
    exercise: Exercise?,
    units: UnitSystem,
    enabled: Boolean,
    actions: LogCardActions,
) {
    val kind = ExerciseKind.of(exercise)
    var openSetId by rememberSaveable(log.id) { mutableStateOf<String?>(null) }
    // The set count when "+" was tapped, so the set it adds opens once it shows up.
    var addedAt by rememberSaveable(log.id) { mutableStateOf<Int?>(null) }
    LaunchedEffect(log.sets.size, addedAt) {
        val before = addedAt ?: return@LaunchedEffect
        if (log.sets.size > before) {
            openSetId = log.sets.last().id
            addedAt = null
        }
    }

    LogCardFrame(selected = openSetId != null) {
        LogHeader(exercise?.name, menu = { close -> RemoveExerciseItem(log, actions, close) }, enabled = enabled)
        Column(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) {
            if (kind == ExerciseKind.Flexibility) {
                HoldEditor(log, units, enabled, actions)
            } else {
                SetsLegend(
                    kind = kind,
                    sets = log.sets,
                    units = units,
                    selectedSetId = openSetId,
                    onSetClick = { openSetId = it.id },
                    onAdd = if (enabled) {
                        {
                            addedAt = log.sets.size
                            actions.onAddSet(log.id)
                        }
                    } else {
                        null
                    },
                )
            }
        }
    }

    val open = log.sets.withIndex().find { it.value.id == openSetId }
    if (open != null) {
        ModalBottomSheet(onDismissRequest = { openSetId = null }) {
            Column(Modifier.padding(start = 24.dp, end = 24.dp, bottom = 32.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "${stringResource(setLabel(kind))} ${open.index + 1}",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.weight(1f),
                    )
                    IconButton(
                        enabled = enabled,
                        onClick = {
                            openSetId = null
                            actions.onDeleteSet(open.value.id)
                        },
                    ) {
                        Icon(painterResource(UiIcons.Trash), stringResource(deleteSetLabel(kind)))
                    }
                }
                SetEditor(kind, open.value.values, units, enabled, { actions.onUpdateSet(open.value.id, it) })
            }
        }
    }
}

@Composable
private fun LogCardFrame(selected: Boolean, content: @Composable () -> Unit) {
    OutlinedCard(
        border = BorderStroke(
            if (selected) 2.dp else 1.dp,
            if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
        ),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column { content() }
    }
}

/** The exercise's name, then [trailing] controls and the overflow [menu]. */
@Composable
private fun LogHeader(
    name: String?,
    menu: @Composable (close: () -> Unit) -> Unit,
    enabled: Boolean,
    trailing: @Composable () -> Unit = {},
) {
    var menuOpen by remember { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 16.dp, end = 4.dp, top = 4.dp, bottom = 4.dp)) {
        Text(
            text = name ?: stringResource(R.string.tracker_activity_unknown_exercise),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.Bold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (enabled) trailing()
        Column {
            IconButton(onClick = { menuOpen = true }, enabled = enabled) {
                Icon(painterResource(UiIcons.MoreVertical), stringResource(R.string.android_tracker_more_options))
            }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) { menu { menuOpen = false } }
        }
    }
    HorizontalDivider()
}

@Composable
private fun RemoveExerciseItem(log: TrackedExerciseLog, actions: LogCardActions, close: () -> Unit) {
    DropdownMenuItem(
        text = { Text(stringResource(R.string.tracker_activity_delete_exercise)) },
        leadingIcon = { Icon(painterResource(UiIcons.Trash), null, Modifier.size(18.dp)) },
        onClick = {
            close()
            actions.onRemove(log.id)
        },
    )
}

/**
 * The sets as columns under a legend (reps and weight, or time and distance), with the average
 * RPE on the right. With [onSetClick] the columns are buttons; with [onAdd] a "+" column follows.
 */
@Composable
private fun SetsLegend(
    kind: ExerciseKind,
    sets: List<TrackedSet>,
    units: UnitSystem,
    selectedSetId: String? = null,
    onSetClick: ((TrackedSet) -> Unit)? = null,
    onAdd: (() -> Unit)? = null,
) {
    val muted = MaterialTheme.colorScheme.onSurfaceVariant
    val cardio = kind == ExerciseKind.Cardio
    Row(verticalAlignment = Alignment.Bottom) {
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.padding(bottom = 6.dp)) {
            LegendLabel(if (cardio) UiIcons.Clock else UiIcons.Hash, stringResource(if (cardio) R.string.tracker_activity_time else R.string.tracker_activity_reps))
            LegendLabel(
                if (cardio) UiIcons.MapPin else UiIcons.Scale,
                if (cardio) stringResource(R.string.tracker_activity_distance_km) else stringResource(R.string.tracker_activity_weight_unit, weightUnit(units)),
            )
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(2.dp),
            modifier = Modifier.weight(1f).padding(start = 8.dp).horizontalScroll(rememberScrollState()),
        ) {
            sets.forEachIndexed { index, set ->
                val selected = set.id == selectedSetId
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier
                        .widthIn(min = 40.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .then(if (selected) Modifier.background(MaterialTheme.colorScheme.primaryContainer) else Modifier)
                        .then(if (onSetClick != null) Modifier.clickable { onSetClick(set) } else Modifier)
                        .padding(horizontal = 6.dp, vertical = 4.dp),
                ) {
                    Text("${stringResource(setLabel(kind))} ${index + 1}", style = MaterialTheme.typography.labelSmall, color = muted)
                    if (cardio) {
                        Text(formatDuration((set.values.duration ?: 0).toLong()), style = MaterialTheme.typography.bodyMedium)
                        Text(set.values.distance?.let(::formatNumber) ?: "-", style = MaterialTheme.typography.bodyMedium)
                    } else {
                        Text(set.values.reps?.takeIf { it != 0 }?.toString() ?: "-", style = MaterialTheme.typography.bodyMedium)
                        Text(set.values.weight?.let { formatNumber(kgToDisplay(it, units)) } ?: "-", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            if (onAdd != null) {
                IconButton(onClick = onAdd, modifier = Modifier.align(Alignment.CenterVertically)) {
                    Icon(painterResource(UiIcons.Plus), stringResource(newSetLabel(kind)), Modifier.size(18.dp), tint = muted)
                }
            }
        }
        averageRpe(sets)?.let { RpeBadge(stringResource(R.string.tracker_activity_avg_rpe), it) }
    }
}

@Composable
private fun LegendLabel(icon: Int, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        Icon(painterResource(icon), null, Modifier.size(12.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(text.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

/** "AVG RPE / 7 / Very Hard", in the level's color. */
@Composable
private fun RpeBadge(title: String, rpe: Int) {
    Column(horizontalAlignment = Alignment.End, modifier = Modifier.padding(start = 8.dp)) {
        Text(title.uppercase(), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("$rpe", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = rpeColor(rpe))
        Text(rpeLabel(rpe), style = MaterialTheme.typography.labelSmall, fontStyle = FontStyle.Italic, color = rpeColor(rpe))
    }
}

/** The classic card's editors: one card per set, the selected one highlighted, then "New set". */
@Composable
private fun SetCards(
    log: TrackedExerciseLog,
    kind: ExerciseKind,
    units: UnitSystem,
    selectedSetId: String?,
    onSelectSet: (String) -> Unit,
    enabled: Boolean,
    actions: LogCardActions,
) {
    val scroll = rememberScrollState()
    // Like the web: a new set scrolls into view.
    var count by remember(log.id) { mutableIntStateOf(log.sets.size) }
    LaunchedEffect(log.sets.size) {
        if (log.sets.size > count) scroll.animateScrollTo(scroll.maxValue)
        count = log.sets.size
    }
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.horizontalScroll(scroll).padding(12.dp),
    ) {
        log.sets.forEachIndexed { index, set ->
            val selected = set.id == selectedSetId
            OutlinedCard(
                border = BorderStroke(if (selected) 2.dp else 1.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant),
                modifier = Modifier.width(176.dp),
            ) {
                Text(
                    text = "${stringResource(setLabel(kind))} ${index + 1}",
                    style = MaterialTheme.typography.labelLarge,
                    color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant)
                        .clickable { onSelectSet(set.id) }
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                )
                SetEditor(kind, set.values, units, enabled, { actions.onUpdateSet(set.id, it) }, Modifier.padding(8.dp))
            }
        }
        if (enabled) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
                modifier = Modifier
                    .width(104.dp)
                    .height(160.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
                    .clickable { actions.onAddSet(log.id) }
                    .padding(8.dp),
            ) {
                Icon(painterResource(UiIcons.Play), null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    stringResource(newSetLabel(kind)),
                    style = MaterialTheme.typography.labelLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

/** A flexibility log is one hold: its time and RPE. */
@Composable
private fun HoldSummary(log: TrackedExerciseLog) {
    val hold = log.sets.firstOrNull()
    Row(verticalAlignment = Alignment.CenterVertically) {
        val durationMs = log.duration?.let { it * 1000L } ?: hold?.values?.duration?.toLong() ?: 0L
        LegendLabel(UiIcons.Clock, "${stringResource(R.string.tracker_activity_duration)}: ${formatDuration(durationMs)}")
        Spacer(Modifier.weight(1f))
        hold?.values?.rpe?.let { RpeBadge("RPE", it) }
    }
}

/**
 * The hold's stopwatch and RPE (the web's FlexibilityHoldCard). The web offers no way to start
 * one; here "Start" adds the hold, so a flexibility log can be recorded at all.
 */
@Composable
private fun HoldEditor(log: TrackedExerciseLog, units: UnitSystem, enabled: Boolean, actions: LogCardActions) {
    val hold = log.sets.firstOrNull()
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.fillMaxWidth().padding(16.dp),
    ) {
        if (hold == null) {
            Text(stringResource(R.string.tracker_activity_no_hold_recorded), color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (enabled) {
                FilledTonalButton(onClick = { actions.onAddSet(log.id) }) {
                    Icon(painterResource(UiIcons.Play), null, Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(R.string.tracker_activity_start))
                }
            }
        } else {
            SetEditor(ExerciseKind.Flexibility, hold.values, units, enabled, { actions.onUpdateSet(hold.id, it) })
        }
    }
}

private fun setLabel(kind: ExerciseKind) = if (kind == ExerciseKind.Cardio) R.string.tracker_activity_lap else R.string.tracker_activity_set

private fun newSetLabel(kind: ExerciseKind) = if (kind == ExerciseKind.Cardio) R.string.tracker_activity_new_lap else R.string.tracker_activity_new_set

private fun deleteSetLabel(kind: ExerciseKind) =
    if (kind == ExerciseKind.Cardio) R.string.tracker_activity_delete_selected_lap else R.string.tracker_activity_delete_selected_set
