package com.trackbit.feature.exerciselists

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.trackbit.core.designsystem.format.formatDuration
import com.trackbit.core.designsystem.format.formatNumber
import com.trackbit.core.designsystem.format.kgToDisplay
import com.trackbit.core.designsystem.format.weightUnit
import com.trackbit.core.i18n.R
import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseListRules
import com.trackbit.core.model.ExerciseListRules.Target
import com.trackbit.core.model.Prescription
import com.trackbit.core.model.UnitSystem

/**
 * Edits one item's targets: what new sets of it start from in a session (weights in the user's
 * unit). Only the targets [category]'s sets record show; see [targetsFor].
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun TargetsSheet(
    exerciseName: String,
    category: ExerciseCategory,
    initial: Prescription,
    units: UnitSystem,
    onDismiss: () -> Unit,
    onSave: (Prescription) -> Unit,
) {
    var form by remember(initial, units) { mutableStateOf(TargetsForm.of(initial, units)) }
    var showProblems by remember { mutableStateOf(false) }
    val problems = if (showProblems) form.problems else emptySet()
    val shown = targetsFor(category)

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Column(
            Modifier.verticalScroll(rememberScrollState()).imePadding().padding(start = 24.dp, end = 24.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(stringResource(R.string.android_lists_targets_title), style = MaterialTheme.typography.titleMedium)
            Text(exerciseName, style = MaterialTheme.typography.bodyLarge)
            Text(
                stringResource(R.string.android_lists_targets_hint),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (Target.Sets in shown) {
                    NumberField(
                        value = form.sets,
                        onChange = { form = form.copy(sets = it) },
                        label = stringResource(if (category == ExerciseCategory.Cardio) R.string.exercises_field_laps else R.string.exercises_field_sets),
                        error = rangeError(Target.Sets in problems, ExerciseListRules.SETS),
                        modifier = Modifier.weight(1f),
                    )
                }
                if (Target.Reps in shown) {
                    NumberField(
                        value = form.reps,
                        onChange = { form = form.copy(reps = it) },
                        label = stringResource(R.string.exercises_field_reps),
                        error = rangeError(Target.Reps in problems, ExerciseListRules.REPS),
                        modifier = Modifier.weight(1f),
                    )
                }
            }
            if (Target.Weight in shown) {
                NumberField(
                    value = form.weight,
                    onChange = { form = form.copy(weight = it) },
                    label = stringResource(R.string.tracker_activity_weight_unit, weightUnit(units)),
                    error = maxError(Target.Weight in problems, formatNumber(kgToDisplay(ExerciseListRules.WEIGHT_MAX_KG, units))),
                    decimal = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (Target.Distance in shown) {
                NumberField(
                    value = form.distance,
                    onChange = { form = form.copy(distance = it) },
                    label = stringResource(R.string.tracker_activity_distance_km),
                    error = maxError(Target.Distance in problems, formatNumber(ExerciseListRules.DISTANCE_MAX_KM)),
                    decimal = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            if (Target.Duration in shown) {
                MinutesSeconds(
                    title = stringResource(R.string.exercises_field_duration),
                    minutes = form.durationMinutes,
                    seconds = form.durationSeconds,
                    onChange = { m, s -> form = form.copy(durationMinutes = m, durationSeconds = s) },
                    error = maxError(Target.Duration in problems, formatDuration(ExerciseListRules.DURATION.last * 1000L)),
                )
            }
            MinutesSeconds(
                title = stringResource(R.string.android_rest_title),
                minutes = form.restMinutes,
                seconds = form.restSeconds,
                onChange = { m, s -> form = form.copy(restMinutes = m, restSeconds = s) },
                error = maxError(Target.Rest in problems, formatDuration(ExerciseListRules.REST.last * 1000L)),
            )
            OutlinedTextField(
                value = form.notes,
                onValueChange = { form = form.copy(notes = it) },
                label = { Text(stringResource(R.string.android_lists_notes)) },
                isError = Target.Notes in problems,
                supportingText = if (Target.Notes in problems) {
                    { Text(stringResource(R.string.common_validation_too_long, ExerciseListRules.NOTES_MAX)) }
                } else {
                    null
                },
                minLines = 2,
                maxLines = 4,
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { form = form.cleared() }) { Text(stringResource(R.string.android_lists_targets_clear)) }
                Spacer(Modifier.weight(1f))
                TextButton(onClick = onDismiss) { Text(stringResource(R.string.common_cancel)) }
                Button(onClick = {
                    val prescription = form.prescription
                    if (prescription == null) showProblems = true else onSave(prescription)
                }) { Text(stringResource(R.string.common_save)) }
            }
        }
    }
}

@Composable
private fun NumberField(
    value: String,
    onChange: (String) -> Unit,
    label: String,
    error: String?,
    modifier: Modifier,
    decimal: Boolean = false,
    /** Marked as wrong without a text of its own (the pair's text shows below both). */
    marked: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { text -> onChange(text.filter { it.isDigit() || (decimal && (it == '.' || it == ',')) }) },
        label = { Text(label) },
        isError = marked || error != null,
        supportingText = error?.let { { Text(it) } },
        singleLine = true,
        keyboardOptions = KeyboardOptions(
            keyboardType = if (decimal) KeyboardType.Decimal else KeyboardType.Number,
            imeAction = ImeAction.Next,
        ),
        modifier = modifier,
    )
}

/** A duration as minutes and seconds, like the app's duration dialog. */
@Composable
private fun MinutesSeconds(title: String, minutes: String, seconds: String, onChange: (String, String) -> Unit, error: String?) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(title, style = MaterialTheme.typography.labelLarge)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            NumberField(
                value = minutes,
                onChange = { onChange(it, seconds) },
                label = stringResource(R.string.android_tracker_minutes),
                error = null,
                marked = error != null,
                modifier = Modifier.weight(1f),
            )
            NumberField(
                value = seconds,
                onChange = { onChange(minutes, it) },
                label = stringResource(R.string.android_tracker_seconds),
                error = null,
                marked = error != null,
                modifier = Modifier.weight(1f),
            )
        }
        error?.let { Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error) }
    }
}

@Composable
private fun rangeError(invalid: Boolean, range: IntRange): String? =
    if (invalid) stringResource(R.string.android_lists_range, range.first.toString(), range.last.toString()) else null

@Composable
private fun maxError(invalid: Boolean, max: String): String? = if (invalid) stringResource(R.string.android_lists_at_most, max) else null
