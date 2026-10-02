package com.trackbit.core.designsystem.component

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.trackbit.core.i18n.R

/** Edits a duration as minutes and seconds: a timed habit's day, a lap, a hold. */
@Composable
fun DurationDialog(title: String, initialMs: Long, onDismiss: () -> Unit, onSave: (Long) -> Unit) {
    var minutes by rememberSaveable { mutableStateOf((initialMs / MS_PER_MINUTE).toString()) }
    var seconds by rememberSaveable { mutableStateOf((initialMs % MS_PER_MINUTE / 1000).toString()) }
    val ms = timeMs(minutes, seconds)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = minutes,
                    onValueChange = { minutes = it.filter(Char::isDigit) },
                    label = { Text(stringResource(R.string.android_tracker_minutes)) },
                    isError = minutes.isNotEmpty() && ms == null,
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Next),
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = seconds,
                    onValueChange = { seconds = it.filter(Char::isDigit) },
                    label = { Text(stringResource(R.string.android_tracker_seconds)) },
                    isError = seconds.isNotEmpty() && ms == null,
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number, imeAction = ImeAction.Done),
                    modifier = Modifier.weight(1f),
                )
            }
        },
        confirmButton = {
            TextButton(onClick = { ms?.let(onSave) }, enabled = ms != null) { Text(stringResource(R.string.common_save)) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(stringResource(R.string.common_cancel)) }
        },
    )
}

/**
 * The time [minutes] and [seconds] describe, or null unless both are whole numbers (empty is 0),
 * seconds are under a minute, and the total fits the server's day value (milliseconds in an int).
 */
fun timeMs(minutes: String, seconds: String): Long? {
    val m = if (minutes.isEmpty()) 0L else minutes.toLongOrNull() ?: return null
    val s = if (seconds.isEmpty()) 0L else seconds.toLongOrNull() ?: return null
    if (s !in 0..59 || m < 0 || m > Int.MAX_VALUE / MS_PER_MINUTE) return null
    return (m * MS_PER_MINUTE + s * 1000).takeIf { it <= Int.MAX_VALUE }
}

private const val MS_PER_MINUTE = 60_000L
