package com.trackbit.feature.account

import androidx.annotation.StringRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
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
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.designsystem.component.DurationDialog
import com.trackbit.core.designsystem.format.formatDuration
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.AccountRules
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.UnitSystem

/** The web's account settings as one screen: profile, preferences, password. */
@Composable
fun AccountScreen(onBack: () -> Unit, viewModel: AccountViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    state.message?.let { message ->
        val text = stringResource(message.text)
        LaunchedEffect(message) {
            snackbar.showSnackbar(text)
            viewModel.onMessageShown(message)
        }
    }

    AccountContent(state, snackbar, onBack, viewModel)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AccountContent(state: AccountUiState, snackbar: SnackbarHostState, onBack: () -> Unit, viewModel: AccountViewModel) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.auth_account_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(painterResource(UiIcons.ArrowLeft), stringResource(R.string.android_session_back))
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        val user = state.user ?: return@Scaffold
        Column(Modifier.padding(padding).fillMaxSize().imePadding().verticalScroll(rememberScrollState())) {
            Profile(state, user, viewModel::editName, viewModel::saveName)
            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            Preferences(user, viewModel)
            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            Password(state, viewModel::editPassword, viewModel::changePassword)
        }
    }
}

@Composable
private fun Profile(state: AccountUiState, user: SessionUser, onName: (String) -> Unit, onSave: () -> Unit) {
    SectionTitle(R.string.auth_account_profile_heading)
    Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        val name = state.shownName.trim()
        OutlinedTextField(
            value = state.shownName,
            onValueChange = onName,
            label = { Text(stringResource(R.string.auth_account_profile_name)) },
            isError = !state.nameValid,
            supportingText = when {
                state.nameValid -> null
                name.length < AccountRules.NAME_LENGTH.first -> {
                    { Text(stringResource(R.string.common_validation_too_short, AccountRules.NAME_LENGTH.first)) }
                }
                else -> {
                    { Text(stringResource(R.string.common_validation_too_long, AccountRules.NAME_LENGTH.last)) }
                }
            },
            singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words),
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = user.email,
            onValueChange = {},
            label = { Text(stringResource(R.string.auth_account_profile_email)) },
            enabled = false,
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        SubmitButton(R.string.auth_account_profile_save, enabled = state.canSaveName, busy = state.savingName, onClick = onSave)
    }
}

@Composable
private fun Preferences(user: SessionUser, viewModel: AccountViewModel) {
    SectionTitle(R.string.auth_account_preferences_heading)
    ChoiceRow(
        label = R.string.auth_account_preferences_language,
        options = SessionUser.LOCALES.map { it to languageName(it) },
        selected = user.locale,
        onSelect = viewModel::setLocale,
    )
    ChoiceRow(
        label = R.string.auth_account_preferences_units,
        options = listOf(UnitSystem.Metric to R.string.nav_unit_metric, UnitSystem.Imperial to R.string.nav_unit_imperial),
        selected = user.unitSystem,
        onSelect = viewModel::setUnitSystem,
    )
    ChoiceRow(
        label = R.string.auth_account_preferences_card_style,
        options = listOf(
            ExerciseLogCardStyle.Classic to R.string.nav_card_style_classic,
            ExerciseLogCardStyle.Compact to R.string.nav_card_style_compact,
        ),
        selected = user.exerciseLogCardStyle,
        onSelect = viewModel::setCardStyle,
    )
    RestRow(user.defaultRestSeconds, viewModel::setDefaultRest)
    ListItem(
        headlineContent = { Text(stringResource(R.string.android_account_timezone)) },
        supportingContent = { Text(stringResource(R.string.android_account_timezone_device, user.timezone)) },
    )
}

/** A language in its own name, as the web's switcher shows it. */
@StringRes
private fun languageName(locale: String): Int = when (locale) {
    "es" -> R.string.nav_language_es
    else -> R.string.nav_language_en
}

/** A setting with a few values: tap to choose one in a dialog. */
@Composable
private fun <T> ChoiceRow(@StringRes label: Int, options: List<Pair<T, Int>>, selected: T, onSelect: (T) -> Unit) {
    var choosing by rememberSaveable { mutableStateOf(false) }
    ListItem(
        headlineContent = { Text(stringResource(label)) },
        supportingContent = { options.find { it.first == selected }?.let { Text(stringResource(it.second)) } },
        modifier = Modifier.clickable { choosing = true },
    )
    if (!choosing) return
    AlertDialog(
        onDismissRequest = { choosing = false },
        title = { Text(stringResource(label)) },
        text = {
            Column {
                for ((value, text) in options) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .selectable(selected = value == selected, role = Role.RadioButton) {
                                choosing = false
                                if (value != selected) onSelect(value)
                            }
                            .padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        RadioButton(selected = value == selected, onClick = null)
                        Text(stringResource(text), Modifier.padding(start = 12.dp))
                    }
                }
            }
        },
        confirmButton = {},
        dismissButton = { TextButton(onClick = { choosing = false }) { Text(stringResource(R.string.common_cancel)) } },
    )
}

/** The user's default rest after each set, the same setting as the session screen's top bar. */
@Composable
private fun RestRow(seconds: Int, onChange: (Int) -> Unit) {
    var editing by rememberSaveable { mutableStateOf(false) }
    ListItem(
        headlineContent = { Text(stringResource(R.string.android_account_rest)) },
        supportingContent = {
            Text(if (seconds > 0) formatDuration(seconds * 1000L) else stringResource(R.string.android_account_rest_off))
        },
        modifier = Modifier.clickable { editing = true },
    )
    if (editing) {
        DurationDialog(
            title = stringResource(R.string.android_rest_default_title),
            initialMs = seconds * 1000L,
            onDismiss = { editing = false },
            onSave = { ms ->
                editing = false
                onChange((ms / 1000).toInt())
            },
        )
    }
}

@Composable
private fun Password(state: AccountUiState, onEdit: ((PasswordForm) -> PasswordForm) -> Unit, onSubmit: () -> Unit) {
    val form = state.password
    SectionTitle(R.string.auth_account_security_heading)
    Column(Modifier.padding(horizontal = 16.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            stringResource(R.string.android_account_password_note),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        PasswordField(R.string.auth_account_security_current, form.current, error = null, ImeAction.Next) { value ->
            onEdit { it.copy(current = value) }
        }
        PasswordField(
            R.string.auth_account_security_new,
            form.new,
            error = if (form.showProblems && form.tooShort) {
                stringResource(R.string.common_validation_too_short, AccountRules.PASSWORD_MIN)
            } else null,
            imeAction = ImeAction.Next,
        ) { value -> onEdit { it.copy(new = value) } }
        PasswordField(
            R.string.auth_account_security_confirm,
            form.confirm,
            error = if (form.showProblems && form.mismatch) stringResource(R.string.auth_account_message_passwords_mismatch) else null,
            imeAction = ImeAction.Done,
            onDone = onSubmit,
        ) { value -> onEdit { it.copy(confirm = value) } }
        SubmitButton(
            R.string.auth_account_security_update,
            enabled = form.current.isNotEmpty() && form.new.isNotEmpty() && !state.changingPassword,
            busy = state.changingPassword,
            onClick = onSubmit,
        )
    }
}

@Composable
private fun PasswordField(
    @StringRes label: Int,
    value: String,
    error: String?,
    imeAction: ImeAction,
    onDone: () -> Unit = {},
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(stringResource(label)) },
        isError = error != null,
        supportingText = error?.let { { Text(it) } },
        singleLine = true,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = imeAction),
        keyboardActions = KeyboardActions(onDone = { onDone() }),
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun SubmitButton(@StringRes text: Int, enabled: Boolean, busy: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        Button(onClick = onClick, enabled = enabled) {
            if (busy) {
                CircularProgressIndicator(Modifier.padding(end = 8.dp).size(16.dp), strokeWidth = 2.dp)
            }
            Text(stringResource(text))
        }
    }
}

@Composable
private fun SectionTitle(@StringRes text: Int) {
    Text(
        text = stringResource(text),
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 8.dp),
    )
}

private val AccountMessage.text: Int
    @StringRes get() = when (this) {
        AccountMessage.ProfileUpdated -> R.string.auth_account_message_profile_updated
        AccountMessage.PasswordChanged -> R.string.auth_account_message_password_changed
        AccountMessage.InvalidPassword -> R.string.android_account_invalid_password
        AccountMessage.Offline -> R.string.android_errors_offline
        AccountMessage.Failed -> R.string.android_account_save_failed
    }
