package com.trackbit.feature.auth

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.trackbit.core.designsystem.theme.TrackbitTheme
import com.trackbit.core.i18n.R

@Composable
fun SignInScreen(viewModel: SignInViewModel = hiltViewModel()) {
    SignInContent(
        state = viewModel.state,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onSubmit = viewModel::submit,
    )
}

@Composable
private fun SignInContent(
    state: SignInUiState,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSubmit: () -> Unit,
) {
    Surface(Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .safeDrawingPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterVertically),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            val fieldModifier = Modifier.widthIn(max = 480.dp).fillMaxWidth()
            Text(
                text = stringResource(R.string.auth_sign_in_title),
                style = MaterialTheme.typography.headlineSmall,
                modifier = fieldModifier,
            )
            Text(
                text = stringResource(R.string.auth_sign_in_description),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = fieldModifier,
            )
            OutlinedTextField(
                value = state.email,
                onValueChange = onEmailChange,
                label = { Text(stringResource(R.string.auth_sign_in_email)) },
                isError = state.error == SignInError.InvalidEmail,
                singleLine = true,
                enabled = !state.submitting,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
                modifier = fieldModifier.semantics { contentType = ContentType.EmailAddress + ContentType.Username },
            )
            OutlinedTextField(
                value = state.password,
                onValueChange = onPasswordChange,
                label = { Text(stringResource(R.string.auth_sign_in_password)) },
                singleLine = true,
                enabled = !state.submitting,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { onSubmit() }),
                modifier = fieldModifier.semantics { contentType = ContentType.Password },
            )
            state.error?.let {
                Text(
                    text = stringResource(it.messageRes),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = fieldModifier,
                )
            }
            Button(onClick = onSubmit, enabled = state.canSubmit, modifier = fieldModifier) {
                Text(
                    stringResource(
                        if (state.submitting) R.string.auth_sign_in_submitting else R.string.auth_sign_in_submit,
                    ),
                )
            }
        }
    }
}

@get:StringRes
private val SignInError.messageRes: Int
    get() = when (this) {
        SignInError.InvalidEmail -> R.string.common_validation_invalid_email
        SignInError.InvalidCredentials -> R.string.android_auth_sign_in_invalid_credentials
        SignInError.EmailNotVerified -> R.string.android_auth_sign_in_email_not_verified
        SignInError.Offline -> R.string.android_errors_offline
        SignInError.Unexpected -> R.string.auth_sign_in_error_unexpected
    }

@Preview
@Composable
private fun SignInPreview() {
    TrackbitTheme {
        SignInContent(
            state = SignInUiState(email = "ada@example.com", error = SignInError.InvalidCredentials),
            onEmailChange = {},
            onPasswordChange = {},
            onSubmit = {},
        )
    }
}
