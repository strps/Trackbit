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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.designsystem.exercise.labelRes
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseDifficulty
import com.trackbit.core.model.ExerciseEquipment
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

        // The info sheet's fields.
        Section(R.string.exercises_form_equipment_label) {
            ChipPicker(ExerciseEquipment.FORM, { it.labelRes }, form.equipment::contains, enabled) { item ->
                onEdit { it.copy(equipment = if (item in it.equipment) it.equipment - item else it.equipment + item) }
            }
        }

        Section(R.string.exercises_form_difficulty_label, hint = R.string.exercises_form_difficulty_hint) {
            // Tapping the picked one again leaves it unrated.
            ChipPicker(ExerciseDifficulty.FORM, { it.labelRes }, { it == form.difficulty }, enabled) { item ->
                onEdit { it.copy(difficulty = item.takeIf { d -> d != it.difficulty }) }
            }
        }

        Section(R.string.exercises_form_variant_of_label, hint = R.string.exercises_form_variant_of_hint) {
            VariantOfPicker(state, enabled) { uuid -> onEdit { it.copy(variantOfUuid = uuid) } }
        }

        StepListEditor(
            title = R.string.exercises_form_instructions_label,
            entries = form.instructions,
            placeholder = { n -> stringResource(R.string.exercises_form_instructions_placeholder, "$n") },
            numbered = true,
            enabled = enabled,
            onChange = { steps -> onEdit { it.copy(instructions = steps) } },
        )
        StepListEditor(
            title = R.string.exercises_form_tips_label,
            entries = form.tips,
            placeholder = { stringResource(R.string.exercises_form_tips_placeholder) },
            numbered = false,
            enabled = enabled,
            onChange = { tips -> onEdit { it.copy(tips = tips) } },
        )
        StepListEditor(
            title = R.string.exercises_form_mistakes_label,
            entries = form.commonMistakes,
            placeholder = { stringResource(R.string.exercises_form_mistakes_placeholder) },
            numbered = false,
            enabled = enabled,
            onChange = { mistakes -> onEdit { it.copy(commonMistakes = mistakes) } },
        )

        if (!state.isNew) DeleteButton(form.name, state.logged, enabled = !state.busy, onDelete)
    }
}

@Composable
private fun Section(title: Int, hint: Int? = null, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        if (hint != null) {
            Text(stringResource(hint), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        content()
    }
}

/** [items] as toggle chips, named by [label]. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun <T> ChipPicker(items: List<T>, label: (T) -> Int?, selected: (T) -> Boolean, enabled: Boolean, onToggle: (T) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        for (item in items) {
            val name = label(item) ?: continue
            FilterChip(selected = selected(item), onClick = { onToggle(item) }, label = { Text(stringResource(name)) }, enabled = enabled)
        }
    }
}

/**
 * The base exercise this one is a variant of, like the web's combobox: a field that opens a
 * searchable list of [ExerciseFormUiState.variantCandidates], and a button to clear it.
 */
@Composable
private fun VariantOfPicker(state: ExerciseFormUiState, enabled: Boolean, onPick: (String?) -> Unit) {
    val candidates = state.variantCandidates
    // An exercise with variants of its own can't become one.
    if (!state.isNew && candidates.isEmpty() && state.variantOf == null) {
        Text(
            stringResource(R.string.exercises_form_variant_of_has_variants),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        return
    }
    var picking by rememberSaveable { mutableStateOf(false) }
    val selected = state.variantOf
    Row(verticalAlignment = Alignment.CenterVertically) {
        OutlinedButton(onClick = { picking = true }, enabled = enabled, modifier = Modifier.weight(1f)) {
            Text(
                selected?.name ?: stringResource(R.string.exercises_form_variant_of_none),
                color = if (selected == null) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
            Icon(painterResource(UiIcons.ChevronDown), contentDescription = null, modifier = Modifier.size(18.dp))
        }
        if (selected != null) {
            IconButton(onClick = { onPick(null) }, enabled = enabled) {
                Icon(painterResource(UiIcons.X), stringResource(R.string.exercises_form_variant_of_clear))
            }
        }
    }
    if (state.invalidVariantOf) {
        Text(
            stringResource(R.string.exercises_error_invalid_variant_of),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.error,
        )
    }
    if (picking) {
        VariantOfDialog(
            candidates = candidates,
            selectedUuid = selected?.uuid,
            onPick = {
                picking = false
                onPick(it)
            },
            onDismiss = { picking = false },
        )
    }
}

@Composable
private fun VariantOfDialog(candidates: List<Exercise>, selectedUuid: String?, onPick: (String) -> Unit, onDismiss: () -> Unit) {
    var search by rememberSaveable { mutableStateOf("") }
    val needle = search.trim()
    val matches = candidates.filter { needle.isEmpty() || it.name.contains(needle, ignoreCase = true) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.exercises_form_variant_of_label)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it },
                    placeholder = { Text(stringResource(R.string.exercises_form_variant_of_search)) },
                    leadingIcon = { Icon(painterResource(UiIcons.Search), contentDescription = null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                LazyColumn(Modifier.heightIn(max = 360.dp)) {
                    if (matches.isEmpty()) {
                        item {
                            Text(
                                stringResource(R.string.exercises_form_variant_of_empty),
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(vertical = 12.dp),
                            )
                        }
                    }
                    items(matches, key = { it.uuid }) { candidate ->
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .selectable(selected = candidate.uuid == selectedUuid, role = Role.RadioButton) { onPick(candidate.uuid) }
                                .padding(vertical = 12.dp),
                        ) {
                            Icon(
                                painterResource(if (candidate.userId != null) UiIcons.User else UiIcons.Globe),
                                contentDescription = stringResource(
                                    if (candidate.userId != null) R.string.exercises_badge_mine else R.string.exercises_badge_system,
                                ),
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(16.dp),
                            )
                            Text(candidate.name, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                            if (candidate.uuid == selectedUuid) {
                                Icon(painterResource(UiIcons.Check), contentDescription = null, modifier = Modifier.size(18.dp))
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.common_cancel)) } },
    )
}

/**
 * An ordered list of short texts (instructions, tips or common mistakes), like the web's
 * `StringListField`: add, remove and move entries. Blank entries are dropped on save.
 */
@Composable
private fun StepListEditor(
    title: Int,
    entries: List<String>,
    placeholder: @Composable (n: Int) -> String,
    numbered: Boolean,
    enabled: Boolean,
    onChange: (List<String>) -> Unit,
) {
    Section(title) {
        entries.forEachIndexed { i, entry ->
            val tooLong = entry.trim().length > ExerciseRules.STEP_LENGTH_MAX
            Row(verticalAlignment = Alignment.Top) {
                OutlinedTextField(
                    value = entry,
                    onValueChange = { text -> onChange(entries.toMutableList().also { it[i] = text }) },
                    placeholder = { Text(placeholder(i + 1)) },
                    prefix = if (numbered) ({ Text("${i + 1}. ") }) else null,
                    isError = tooLong,
                    supportingText = if (tooLong) {
                        { Text(stringResource(R.string.common_validation_too_long, ExerciseRules.STEP_LENGTH_MAX)) }
                    } else null,
                    enabled = enabled,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                    modifier = Modifier.weight(1f),
                )
                IconButton(onClick = { onChange(entries.move(i, i - 1)) }, enabled = enabled && i > 0) {
                    Icon(painterResource(UiIcons.ArrowUp), stringResource(R.string.exercises_form_list_move_up), Modifier.size(18.dp))
                }
                IconButton(onClick = { onChange(entries.move(i, i + 1)) }, enabled = enabled && i < entries.lastIndex) {
                    Icon(painterResource(UiIcons.ArrowDown), stringResource(R.string.exercises_form_list_move_down), Modifier.size(18.dp))
                }
                IconButton(onClick = { onChange(entries.filterIndexed { j, _ -> j != i }) }, enabled = enabled) {
                    Icon(painterResource(UiIcons.X), stringResource(R.string.exercises_form_list_remove), Modifier.size(18.dp))
                }
            }
        }
        if (entries.size < ExerciseRules.STEPS_MAX) {
            TextButton(onClick = { onChange(entries + "") }, enabled = enabled) {
                Icon(painterResource(UiIcons.Plus), contentDescription = null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.exercises_form_list_add), Modifier.padding(start = 8.dp))
            }
        }
    }
}

/** This list with the entry at [from] moved to [to]. */
private fun List<String>.move(from: Int, to: Int): List<String> = toMutableList().apply { add(to, removeAt(from)) }

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
