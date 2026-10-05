package com.trackbit.feature.exerciselists

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import com.trackbit.core.i18n.R
import com.trackbit.core.model.ExerciseListRules
import com.trackbit.core.model.ExerciseListRules.Problem

/** Creates a list or renames one, like the web's `ListFormDialog`. */
@Composable
internal fun ListFormDialog(
    form: ListForm,
    isNew: Boolean,
    busy: Boolean,
    onEdit: ((ListForm) -> ListForm) -> Unit,
    onDismiss: () -> Unit,
    onSubmit: () -> Unit,
) {
    val problems = if (form.showProblems) form.problems else emptySet()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(if (isNew) R.string.lists_form_create_title else R.string.lists_form_edit_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = form.name,
                    onValueChange = { name -> onEdit { it.edit(name = name) } },
                    label = { Text(stringResource(R.string.lists_form_name_label)) },
                    placeholder = { Text(stringResource(R.string.lists_form_name_placeholder)) },
                    isError = Problem.NameLength in problems || form.nameTaken,
                    supportingText = when {
                        form.nameTaken -> {
                            { Text(stringResource(R.string.lists_error_name_taken_body)) }
                        }
                        Problem.NameLength in problems -> {
                            {
                                Text(
                                    if (form.name.isBlank()) {
                                        stringResource(R.string.common_validation_too_short, ExerciseListRules.NAME_LENGTH.first)
                                    } else {
                                        stringResource(R.string.common_validation_too_long, ExerciseListRules.NAME_LENGTH.last)
                                    },
                                )
                            }
                        }
                        else -> null
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                )
                OutlinedTextField(
                    value = form.description,
                    onValueChange = { description -> onEdit { it.edit(description = description) } },
                    label = { Text(stringResource(R.string.lists_form_description_label)) },
                    placeholder = { Text(stringResource(R.string.lists_form_description_placeholder)) },
                    isError = Problem.DescriptionLength in problems,
                    supportingText = if (Problem.DescriptionLength in problems) {
                        { Text(stringResource(R.string.common_validation_too_long, ExerciseListRules.DESCRIPTION_MAX)) }
                    } else {
                        null
                    },
                    minLines = 2,
                    maxLines = 4,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = onSubmit, enabled = !busy) {
                Text(stringResource(if (isNew) R.string.lists_form_create else R.string.lists_form_save))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.lists_form_cancel)) }
        },
        modifier = Modifier,
    )
}

@Composable
internal fun ListsMessage.text(): String = when (this) {
    ListsMessage.Offline -> stringResource(R.string.android_errors_offline)
    ListsMessage.Failed -> stringResource(R.string.lists_error_generic_body)
    ListsMessage.Frozen -> stringResource(R.string.errors_limits_exercise_list_frozen_body)
    ListsMessage.NotFound -> stringResource(R.string.android_lists_not_found)
    is ListsMessage.LimitReached -> stringResource(R.string.errors_limits_exercise_list_limit_reached_body, maxExerciseLists)
    is ListsMessage.Full -> pluralStringResource(R.plurals.android_lists_full, maxItems, maxItems)
}
