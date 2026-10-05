package com.trackbit.feature.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.autofill.ContentType
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentType
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.tooling.preview.Preview
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.trackbit.core.designsystem.theme.TrackbitTheme
import com.trackbit.core.i18n.R
import com.trackbit.core.model.AccountRules

@Composable
fun SignUpScreen(onSignIn: () -> Unit, viewModel: SignUpViewModel = hiltViewModel()) {
    SignUpContent(
        state = viewModel.state,
        onNameChange = viewModel::onNameChange,
        onEmailChange = viewModel::onEmailChange,
        onPasswordChange = viewModel::onPasswordChange,
        onPasswordConfirmChange = viewModel::onPasswordConfirmChange,
        onInviteCodeChange = viewModel::onInviteCodeChange,
        onSubmit = viewModel::submit,
        onSignIn = onSignIn,
    )
}

@Composable
private fun SignUpContent(
    state: SignUpUiState,
    onNameChange: (String) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onPasswordConfirmChange: (String) -> Unit,
    onInviteCodeChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onSignIn: () -> Unit,
) {
    AuthLayout(
        title = stringResource(R.string.auth_sign_up_title),
        description = stringResource(R.string.auth_sign_up_description),
    ) {
        if (state.created) {
            AuthMessage(stringResource(R.string.auth_sign_up_success), isError = false)
            Button(onClick = onSignIn, modifier = AuthFieldModifier) {
                Text(stringResource(R.string.auth_verify_back_signin))
            }
            return@AuthLayout
        }
        val enabled = !state.submitting
        val fieldError = state.error?.field
        SignUpTextField(
            value = state.name,
            onValueChange = onNameChange,
            label = stringResource(R.string.auth_sign_up_name),
            field = SignUpField.Name,
            state = state,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Next),
            contentType = ContentType.PersonFullName,
        )
        SignUpTextField(
            value = state.email,
            onValueChange = onEmailChange,
            label = stringResource(R.string.auth_sign_up_email),
            field = SignUpField.Email,
            state = state,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Next),
            contentType = ContentType.EmailAddress + ContentType.NewUsername,
        )
        SignUpTextField(
            value = state.password,
            onValueChange = onPasswordChange,
            label = stringResource(R.string.auth_sign_up_password),
            field = SignUpField.Password,
            state = state,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Next),
            contentType = ContentType.NewPassword,
            password = true,
        )
        SignUpTextField(
            value = state.passwordConfirm,
            onValueChange = onPasswordConfirmChange,
            label = stringResource(R.string.auth_sign_up_password_confirm),
            field = SignUpField.PasswordConfirm,
            state = state,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = ImeAction.Next),
            contentType = ContentType.NewPassword,
            password = true,
        )
        SignUpTextField(
            value = state.inviteCode,
            onValueChange = onInviteCodeChange,
            label = stringResource(R.string.auth_sign_up_invite_code),
            field = SignUpField.InviteCode,
            state = state,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onSubmit() }),
            supportingText = stringResource(R.string.android_auth_sign_up_invite_optional),
        )
        // Errors without a field show above the button.
        state.error?.takeIf { fieldError == null }?.let { AuthMessage(it.message(), isError = true) }
        Button(onClick = onSubmit, enabled = state.canSubmit, modifier = AuthFieldModifier) {
            Text(stringResource(if (state.submitting) R.string.auth_sign_up_submitting else R.string.auth_sign_up_submit))
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
            Text(
                text = stringResource(R.string.auth_sign_up_already_have_account),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            TextButton(onClick = onSignIn, enabled = enabled) {
                Text(stringResource(R.string.auth_sign_up_signin_link))
            }
        }
    }
}

@Composable
private fun SignUpTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    field: SignUpField,
    state: SignUpUiState,
    keyboardOptions: KeyboardOptions,
    contentType: ContentType? = null,
    password: Boolean = false,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    supportingText: String? = null,
) {
    val error = state.error?.takeIf { it.field == field }
    val support = error?.message() ?: supportingText
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        isError = error != null,
        supportingText = support?.let { { Text(it) } },
        singleLine = true,
        enabled = !state.submitting,
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        modifier = if (contentType != null) AuthFieldModifier.semantics { this.contentType = contentType } else AuthFieldModifier,
    )
}

@Composable
private fun SignUpError.message(): String = when (this) {
    SignUpError.NameTooLong -> stringResource(R.string.common_validation_too_long, AccountRules.NAME_LENGTH.last)
    SignUpError.InvalidEmail -> stringResource(R.string.common_validation_invalid_email)
    SignUpError.EmailTaken -> stringResource(R.string.android_auth_sign_up_email_taken)
    SignUpError.PasswordTooShort -> stringResource(R.string.common_validation_too_short, AccountRules.PASSWORD_MIN)
    SignUpError.PasswordsMismatch -> stringResource(R.string.auth_sign_up_passwords_mismatch)
    SignUpError.InviteInvalid -> stringResource(R.string.android_auth_sign_up_invite_invalid)
    SignUpError.InviteUsedUp -> stringResource(R.string.android_auth_sign_up_invite_used_up)
    SignUpError.InviteExpired -> stringResource(R.string.android_auth_sign_up_invite_expired)
    SignUpError.Offline -> stringResource(R.string.android_errors_offline)
    SignUpError.Unexpected -> stringResource(R.string.auth_sign_up_error_registration)
}

@Preview
@Composable
private fun SignUpPreview() {
    TrackbitTheme {
        SignUpContent(
            state = SignUpUiState(name = "Ada", email = "ada@example.com", inviteCode = "OLD", error = SignUpError.InviteExpired),
            onNameChange = {},
            onEmailChange = {},
            onPasswordChange = {},
            onPasswordConfirmChange = {},
            onInviteCodeChange = {},
            onSubmit = {},
            onSignIn = {},
        )
    }
}
