package com.trackbit.feature.auth

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.trackbit.core.designsystem.theme.TrackbitTheme
import com.trackbit.core.i18n.R

@Composable
fun SignInScreen(
    onSignUp: () -> Unit,
    onForgotPassword: (email: String) -> Unit,
    viewModel: SignInViewModel = hiltViewModel(),
) {
    SignInContent(
        state = viewModel.state,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onSubmit = viewModel::submit,
        onResend = viewModel::resendVerification,
        onSignUp = onSignUp,
        onForgotPassword = { onForgotPassword(viewModel.state.email.trim()) },
    )
}

@Composable
private fun SignInContent(
    state: SignInUiState,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onResend: () -> Unit,
    onSignUp: () -> Unit,
    onForgotPassword: () -> Unit,
) {
    AuthLayout(
        title = stringResource(R.string.auth_sign_in_title),
        description = stringResource(R.string.auth_sign_in_description),
    ) {
        OutlinedTextField(
            value = state.email,
            onValueChange = onEmailChange,
            label = { Text(stringResource(R.string.auth_sign_in_email)) },
            isError = state.error == SignInError.InvalidEmail,
            singleLine = true,
            enabled = !state.submitting,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            modifier = AuthFieldModifier.semantics { contentType = ContentType.EmailAddress + ContentType.Username },
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
            modifier = AuthFieldModifier.semantics { contentType = ContentType.Password },
        )
        state.error?.let { AuthMessage(stringResource(it.messageRes), isError = true) }
        if (state.error == SignInError.EmailNotVerified) {
            ResendVerification(state.resend, onResend)
        }
        Button(onClick = onSubmit, enabled = state.canSubmit, modifier = AuthFieldModifier) {
            Text(
                stringResource(
                    if (state.submitting) R.string.auth_sign_in_submitting else R.string.auth_sign_in_submit,
                ),
            )
        }
        TextButton(onClick = onForgotPassword, enabled = !state.submitting) {
            Text(stringResource(R.string.auth_sign_in_forgot_password))
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
            Text(
                text = stringResource(R.string.auth_sign_in_no_account),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            TextButton(onClick = onSignUp, enabled = !state.submitting) {
                Text(stringResource(R.string.auth_sign_in_signup_link))
            }
        }
    }
}

@Composable
private fun ResendVerification(resend: ResendState, onResend: () -> Unit) {
    when (resend) {
        ResendState.Sent -> AuthMessage(stringResource(R.string.auth_verify_resend_success), isError = false)
        else -> {
            if (resend == ResendState.Failed) AuthMessage(stringResource(R.string.auth_verify_resend_error), isError = true)
            OutlinedButton(onClick = onResend, enabled = resend != ResendState.Sending, modifier = AuthFieldModifier) {
                Text(
                    stringResource(
                        if (resend == ResendState.Sending) R.string.auth_verify_resend_submitting else R.string.auth_verify_resend_submit,
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
            state = SignInUiState(email = "ada@example.com", error = SignInError.EmailNotVerified),
            onEmailChange = {},
            onPasswordChange = {},
            onSubmit = {},
            onResend = {},
            onSignUp = {},
            onForgotPassword = {},
        )
    }
}
