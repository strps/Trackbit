package com.trackbit.feature.exerciselibrary

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseRules
import com.trackbit.core.model.MuscleGroup

/** Creates a custom exercise, or edits the route's one: the web's exercise dialog as a full screen. */
@Composable
fun ExerciseFormScreen(onDone: () -> Unit, viewModel: ExerciseFormViewModel = hiltViewModel()) {
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

    ExerciseFormContent(
        state = state,
        snackbar = snackbar,
        onClose = onDone,
        onRetry = viewModel::load,
        onEdit = viewModel::edit,
        onToggleMuscle = viewModel::toggleMuscleGroup,
        onSave = viewModel::save,
        onDelete = viewModel::delete,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExerciseFormContent(
    state: ExerciseFormUiState,
    snackbar: SnackbarHostState,
    onClose: () -> Unit,
    onRetry: () -> Unit,
    onEdit: ((ExerciseForm) -> ExerciseForm) -> Unit,
    onToggleMuscle: (Int) -> Unit,
    onSave: () -> Unit,
    onDelete: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(if (state.isNew) R.string.exercises_form_create_title else R.string.exercises_form_edit_title)) },
                navigationIcon = {
                    IconButton(onClick = onClose) {
                        Icon(painterResource(UiIcons.ArrowLeft), stringResource(R.string.common_cancel))
                    }
                },
                actions = {
                    TextButton(onClick = onSave, enabled = state.canSave) { Text(stringResource(R.string.common_save)) }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        when {
            state.loading -> Box(Modifier.padding(padding).fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(stringResource(R.string.common_loading), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            state.loadFailed -> Column(
                Modifier.padding(padding).fillMaxSize().padding(24.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(stringResource(R.string.android_errors_offline), textAlign = TextAlign.Center)
                TextButton(onClick = onRetry) { Text(stringResource(R.string.android_retry)) }
            }
            else -> FormFields(state, onEdit, onToggleMuscle, onDelete, Modifier.padding(padding))
        }
    }
}

@Composable
private fun FormFields(
    state: ExerciseFormUiState,
    onEdit: ((ExerciseForm) -> ExerciseForm) -> Unit,
    onToggleMuscle: (Int) -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier,
) {
    val form = state.form
    val enabled = !state.frozen && !state.busy
    val problems = if (state.showProblems) form.problems else emptySet()

    Column(
        modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        if (state.frozen) FrozenBanner()

        val nameError = when {
            state.nameTaken -> stringResource(R.string.exercises_error_name_taken_body)
            ExerciseRules.Problem.NameLength !in problems -> null
            form.name.isBlank() -> stringResource(R.string.common_validation_too_short, ExerciseRules.NAME_LENGTH.first)
            else -> stringResource(R.string.common_validation_too_long, ExerciseRules.NAME_LENGTH.last)
        }
        OutlinedTextField(
            value = form.name,
            onValueChange = { name -> onEdit { it.copy(name = name) } },
            label = { Text(stringResource(R.string.exercises_form_name_label)) },
            placeholder = { Text(stringResource(R.string.exercises_form_name_placeholder)) },
            isError = nameError != null,
            supportingText = nameError?.let { { Text(it) } },
            singleLine = true,
            enabled = enabled,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            modifier = Modifier.fillMaxWidth(),
        )

        val descriptionTooLong = ExerciseRules.Problem.DescriptionLength in problems
        OutlinedTextField(
            value = form.description,
            onValueChange = { description -> onEdit { it.copy(description = description) } },
            label = { Text(stringResource(R.string.exercises_form_description_label)) },
            placeholder = { Text(stringResource(R.string.exercises_form_description_placeholder)) },
            isError = descriptionTooLong,
            supportingText = if (descriptionTooLong) {
                { Text(stringResource(R.string.common_validation_too_long, ExerciseRules.DESCRIPTION_MAX)) }
            } else null,
            minLines = 3,
            enabled = enabled,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            modifier = Modifier.fillMaxWidth(),
        )

        Section(R.string.exercises_form_muscles_label) {
            MusclePicker(state.muscleGroups, form.muscleGroups, enabled, onToggleMuscle)
        }

        Section(R.string.exercises_form_category_label) {
            for (category in ExerciseCategory.FORM) {
                CategoryOption(category, selected = form.category == category, enabled = enabled) {
                    onEdit { it.copy(category = category) }
                }
            }
        }

        if (!state.isNew) DeleteButton(form.name, state.logged, enabled = !state.busy, onDelete)
    }
}

@Composable
private fun Section(title: Int, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        content()
    }
}

@Composable
private fun FrozenBanner() {
    Surface(color = MaterialTheme.colorScheme.tertiaryContainer, shape = RoundedCornerShape(12.dp)) {
        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(painterResource(UiIcons.Lock), contentDescription = null, modifier = Modifier.size(18.dp))
            Column {
                Text(stringResource(R.string.errors_limits_custom_exercise_frozen_title), fontWeight = FontWeight.SemiBold)
                Text(stringResource(R.string.errors_limits_custom_exercise_frozen_body), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/** Every muscle group as a toggle chip, like the web's multi-select. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun MusclePicker(groups: List<MuscleGroup>, selected: Set<Int>, enabled: Boolean, onToggle: (Int) -> Unit) {
    if (groups.isEmpty()) {
        Text(
            stringResource(R.string.exercises_form_muscles_empty),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        return
    }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for (group in groups) {
            FilterChip(
                selected = group.id in selected,
                onClick = { onToggle(group.id) },
                label = { Text(group.name) },
                enabled = enabled,
            )
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CategoryOption(category: ExerciseCategory, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val border = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
    OutlinedCard(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, enabled = enabled, role = Role.RadioButton, onClick = onClick),
        border = BorderStroke(if (selected) 2.dp else 1.dp, border),
    ) {
        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(
                painterResource(category.icon),
                contentDescription = null,
                tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp),
            )
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(stringResource(category.labelRes), fontWeight = FontWeight.Bold)
                Text(
                    stringResource(category.descriptionRes),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                // What a log of it records, as the web's card shows under "Inputs:".
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.Center) {
                    Text(
                        stringResource(R.string.exercises_form_inputs),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    for (field in category.fieldRes) {
                        Text(stringResource(field), style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            if (selected) {
                Icon(painterResource(UiIcons.Check), contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
            }
        }
    }
}

@Composable
private fun DeleteButton(name: String, logged: Boolean, enabled: Boolean, onDelete: () -> Unit) {
    var confirming by rememberSaveable { mutableStateOf(false) }
    OutlinedButton(
        onClick = { confirming = true },
        enabled = enabled,
        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Icon(painterResource(UiIcons.Trash), contentDescription = null, modifier = Modifier.size(18.dp))
        Text(stringResource(R.string.exercises_delete_confirm), Modifier.padding(start = 8.dp))
    }
    if (confirming) {
        val body = stringResource(R.string.exercises_delete_body)
        val loggedBody = stringResource(R.string.exercises_delete_body_logged)
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text(stringResource(R.string.exercises_delete_title, name)) },
            text = { Text(if (logged) "$body $loggedBody" else body) },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirming = false
                        onDelete()
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                ) { Text(stringResource(R.string.exercises_delete_confirm)) }
            },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text(stringResource(R.string.exercises_delete_cancel)) } },
        )
    }
}

@Composable
private fun ExerciseFormMessage.text(): String = when (this) {
    ExerciseFormMessage.Offline -> stringResource(R.string.android_errors_offline)
    ExerciseFormMessage.Failed -> stringResource(R.string.exercises_error_generic_body)
    ExerciseFormMessage.NotFound -> stringResource(R.string.android_exercises_not_found)
    ExerciseFormMessage.Frozen -> stringResource(R.string.errors_limits_custom_exercise_frozen_body)
    is ExerciseFormMessage.LimitReached -> stringResource(R.string.errors_limits_custom_exercise_limit_reached_body, maxCustomExercises)
}
