package com.trackbit.feature.session

import android.os.SystemClock
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.trackbit.core.designsystem.component.DurationDialog
import com.trackbit.core.designsystem.format.displayToKg
import com.trackbit.core.designsystem.format.formatDuration
import com.trackbit.core.designsystem.format.formatNumber
import com.trackbit.core.designsystem.format.kgToDisplay
import com.trackbit.core.designsystem.format.round
import com.trackbit.core.designsystem.format.weightUnit
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.SetValues
import com.trackbit.core.model.UnitSystem
import kotlinx.coroutines.delay

/**
 * The controls of one set, by [kind]: reps, weight and RPE for strength; time, distance and RPE
 * for cardio; time and RPE for a flexibility hold. Every change is a whole new [SetValues].
 */
@Composable
internal fun SetEditor(
    kind: ExerciseKind,
    values: SetValues,
    units: UnitSystem,
    enabled: Boolean,
    onChange: (SetValues) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        when (kind) {
            ExerciseKind.Strength -> {
                NumberStepper(
                    value = values.reps?.toDouble(),
                    onChange = { onChange(values.copy(reps = it?.toInt())) },
                    step = 1.0,
                    decimals = 0,
                    label = stringResource(R.string.tracker_activity_reps),
                    enabled = enabled,
                )
                NumberStepper(
                    value = values.weight?.let { kgToDisplay(it, units) },
                    onChange = { onChange(values.copy(weight = it?.let { w -> displayToKg(w, units) })) },
                    step = weightStep(units),
                    decimals = 2,
                    label = stringResource(R.string.tracker_activity_weight_unit, weightUnit(units)),
                    enabled = enabled,
                )
            }
            ExerciseKind.Cardio -> {
                Stopwatch(values.duration, enabled) { onChange(values.copy(duration = it)) }
                NumberStepper(
                    value = values.distance,
                    onChange = { onChange(values.copy(distance = it)) },
                    step = 0.1,
                    decimals = 2,
                    label = stringResource(R.string.tracker_activity_distance_km),
                    enabled = enabled,
                )
            }
            ExerciseKind.Flexibility -> Stopwatch(values.duration, enabled) { onChange(values.copy(duration = it)) }
        }
        RpeSelector(values.rpe, enabled, showLabel = kind == ExerciseKind.Flexibility) { onChange(values.copy(rpe = it)) }
    }
}

/**
 * − value +, like the web's NumericStepper. The value can be typed too: it's applied when the
 * field loses focus or on Done; empty clears it, anything not a number ≥ 0 is dropped.
 */
@Composable
internal fun NumberStepper(
    value: Double?,
    onChange: (Double?) -> Unit,
    step: Double,
    decimals: Int,
    label: String,
    enabled: Boolean,
) {
    val shown = value?.let(::formatNumber).orEmpty()
    var text by remember(shown) { mutableStateOf(shown) }
    var focused by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current

    fun commit() {
        val typed = text.trim().replace(',', '.')
        val parsed = if (typed.isEmpty()) null else typed.toDoubleOrNull()?.takeIf { it >= 0 }?.let { round(it, decimals) }
        if (typed.isNotEmpty() && parsed == null) text = shown else if (parsed != value) onChange(parsed)
    }

    Column {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .height(40.dp)
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp)),
        ) {
            IconButton(
                onClick = { onChange(round(maxOf(0.0, (value ?: 0.0) - step), decimals)) },
                enabled = enabled && value != null && value > 0,
                modifier = Modifier.size(40.dp),
            ) {
                Icon(painterResource(UiIcons.Minus), stringResource(R.string.android_session_decrease, label), Modifier.size(16.dp))
            }
            BasicTextField(
                value = text,
                onValueChange = { typed -> text = typed.filter { it.isDigit() || it == '.' || it == ',' } },
                enabled = enabled,
                singleLine = true,
                textStyle = MaterialTheme.typography.titleMedium.copy(
                    color = LocalContentColor.current,
                    textAlign = TextAlign.Center,
                ),
                cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                keyboardOptions = KeyboardOptions(
                    keyboardType = if (decimals == 0) KeyboardType.Number else KeyboardType.Decimal,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { focusManager.clearFocus() }),
                decorationBox = { field ->
                    Box(contentAlignment = Alignment.Center) {
                        if (text.isEmpty()) {
                            Text("—", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        field()
                    }
                },
                modifier = Modifier
                    .weight(1f)
                    .semantics { contentDescription = label }
                    .onFocusChanged {
                        if (focused && !it.isFocused) commit()
                        focused = it.isFocused
                    },
            )
            IconButton(
                onClick = { onChange(round((value ?: 0.0) + step, decimals)) },
                enabled = enabled,
                modifier = Modifier.size(40.dp),
            ) {
                Icon(painterResource(UiIcons.Plus), stringResource(R.string.android_session_increase, label), Modifier.size(16.dp))
            }
        }
    }
}

/** Ten pips, filled up to [value] in the scale's colors. Tapping the chosen level clears it. */
@Composable
internal fun RpeSelector(value: Int?, enabled: Boolean, showLabel: Boolean, onChange: (Int?) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("RPE", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (value != null) {
                Text("$value", style = MaterialTheme.typography.labelLarge, color = rpeColor(value))
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(3.dp), modifier = Modifier.fillMaxWidth()) {
            for (level in 1..10) {
                val description = stringResource(R.string.android_session_rpe_level, level, rpeLabel(level))
                Box(
                    Modifier
                        .weight(1f)
                        .height(24.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(if (value != null && level <= value) rpeColor(value) else MaterialTheme.colorScheme.surfaceVariant)
                        .clickable(enabled = enabled) { onChange(if (level == value) null else level) }
                        .semantics { contentDescription = description },
                )
            }
        }
        if (showLabel && value != null) {
            Text(
                rpeLabel(value),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.End,
            )
        }
    }
}

/** An RPE level's name ("Hard"), from the web's locale files. */
@Composable
internal fun rpeLabel(level: Int): String = stringResource(RPE_LABELS[level - 1])

private val RPE_LABELS = intArrayOf(
    R.string.tracker_rpe_level_1, R.string.tracker_rpe_level_2, R.string.tracker_rpe_level_3,
    R.string.tracker_rpe_level_4, R.string.tracker_rpe_level_5, R.string.tracker_rpe_level_6,
    R.string.tracker_rpe_level_7, R.string.tracker_rpe_level_8, R.string.tracker_rpe_level_9,
    R.string.tracker_rpe_level_10,
)

/**
 * A lap's or hold's time, like the web's editable timer: play runs a stopwatch from the saved
 * time, pause saves the new total, and tapping the time edits it. The stopwatch runs on this
 * screen only (it survives rotation, not leaving the screen); nothing is saved while it runs.
 */
@Composable
internal fun Stopwatch(durationMs: Int?, enabled: Boolean, onCommit: (Int) -> Unit) {
    val base = (durationMs ?: 0).toLong()
    // Elapsed-realtime when play was pressed, or null while paused.
    var startedAt by rememberSaveable { mutableStateOf<Long?>(null) }
    var now by remember { mutableLongStateOf(SystemClock.elapsedRealtime()) }
    var editing by rememberSaveable { mutableStateOf(false) }

    LaunchedEffect(startedAt) {
        while (startedAt != null) {
            now = SystemClock.elapsedRealtime()
            delay(100)
        }
    }
    val shownMs = base + (startedAt?.let { now - it } ?: 0L)

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp)),
    ) {
        Text(
            text = formatDuration(shownMs),
            style = MaterialTheme.typography.titleLarge,
            textAlign = TextAlign.Center,
            modifier = Modifier
                .weight(1f)
                .clickable(enabled = enabled && startedAt == null, onClickLabel = stringResource(R.string.android_session_edit_time)) {
                    editing = true
                }
                .padding(vertical = 8.dp),
        )
        val running = startedAt != null
        IconButton(
            enabled = enabled,
            onClick = {
                val start = startedAt
                if (start == null) {
                    now = SystemClock.elapsedRealtime()
                    startedAt = now
                } else {
                    startedAt = null
                    onCommit((base + SystemClock.elapsedRealtime() - start).coerceAtMost(Int.MAX_VALUE.toLong()).toInt())
                }
            },
        ) {
            Icon(
                painterResource(if (running) UiIcons.Pause else UiIcons.Play),
                contentDescription = stringResource(
                    if (running) R.string.android_session_pause_stopwatch else R.string.android_session_start_stopwatch,
                ),
                tint = if (running) MaterialTheme.colorScheme.error else LocalContentColor.current,
            )
        }
    }
    if (editing) {
        DurationDialog(
            title = stringResource(R.string.tracker_activity_duration),
            initialMs = base,
            onDismiss = { editing = false },
            onSave = { ms ->
                editing = false
                onCommit(ms.toInt())
            },
        )
    }
}
