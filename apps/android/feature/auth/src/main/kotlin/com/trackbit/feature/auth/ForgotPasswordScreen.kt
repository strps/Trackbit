package com.trackbit.feature.auth

import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.tooling.preview.Preview
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.trackbit.core.designsystem.theme.TrackbitTheme
import com.trackbit.core.i18n.R

@Composable
fun ForgotPasswordScreen(onBack: () -> Unit, viewModel: ForgotPasswordViewModel = hiltViewModel()) {
    ForgotPasswordContent(
        state = viewModel.state,
        onEmailChange = viewModel::onEmailChange,
        onSubmit = viewModel::submit,
        onBack = onBack,
    )
}

@Composable
private fun ForgotPasswordContent(
    state: ForgotPasswordUiState,
    onEmailChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onBack: () -> Unit,
) {
    AuthLayout(
        title = stringResource(R.string.auth_forgot_title),
        description = stringResource(R.string.auth_forgot_description),
    ) {
        OutlinedTextField(
            value = state.email,
            onValueChange = onEmailChange,
            label = { Text(stringResource(R.string.auth_forgot_email)) },
            isError = state.error == ForgotPasswordError.InvalidEmail,
            singleLine = true,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onSubmit() }),
            modifier = AuthFieldModifier.semantics { contentType = ContentType.EmailAddress + ContentType.Username },
        )
        state.error?.let {
            val message = when (it) {
                ForgotPasswordError.InvalidEmail -> R.string.common_validation_invalid_email
                ForgotPasswordError.Offline -> R.string.android_errors_offline
                ForgotPasswordError.Unexpected -> R.string.auth_sign_up_error_unexpected
            }
            AuthMessage(stringResource(message), isError = true)
        }
        if (state.sent) AuthMessage(stringResource(R.string.android_auth_forgot_sent), isError = false)
        Button(onClick = onSubmit, enabled = state.canSubmit, modifier = AuthFieldModifier) {
            Text(stringResource(if (state.submitting) R.string.auth_forgot_submitting else R.string.auth_forgot_submit))
        }
        TextButton(onClick = onBack) { Text(stringResource(R.string.auth_forgot_back)) }
    }
}

@Preview
@Composable
private fun ForgotPasswordPreview() {
    TrackbitTheme {
        ForgotPasswordContent(
            state = ForgotPasswordUiState(email = "ada@example.com", sent = true),
            onEmailChange = {},
            onSubmit = {},
            onBack = {},
        )
    }
}
