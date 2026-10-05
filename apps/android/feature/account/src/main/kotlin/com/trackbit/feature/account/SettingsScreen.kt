package com.trackbit.feature.account

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.clickable
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.SessionUser

/**
 * The Settings tab: the web's configuration links and account menu in one list. Each entry opens
 * its own screen; the app wires them ([onOpenAccount], [onOpenHabits]).
 */
@Composable
fun SettingsScreen(
    onOpenAccount: () -> Unit,
    onOpenHabits: () -> Unit,
    onOpenExercises: () -> Unit,
    onOpenLists: () -> Unit,
    onSignOut: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel(),
) {
    val user by viewModel.user.collectAsStateWithLifecycle()
    SettingsContent(user, onOpenAccount, onOpenHabits, onOpenExercises, onOpenLists, onSignOut)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsContent(
    user: SessionUser?,
    onOpenAccount: () -> Unit,
    onOpenHabits: () -> Unit,
    onOpenExercises: () -> Unit,
    onOpenLists: () -> Unit,
    onSignOut: () -> Unit,
) {
    Scaffold(topBar = { TopAppBar(title = { Text(stringResource(R.string.nav_settings)) }) }) { padding ->
        Column(Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState())) {
            if (user != null) {
                // The user opens their account settings, like the web's user menu.
                ListItem(
                    headlineContent = { Text(user.name) },
                    supportingContent = { Text(user.email) },
                    trailingContent = {
                        Icon(painterResource(UiIcons.ChevronRight), contentDescription = stringResource(R.string.auth_account_title))
                    },
                    modifier = Modifier.clickable(onClick = onOpenAccount),
                    leadingContent = {
                        Box(
                            Modifier.size(40.dp).background(MaterialTheme.colorScheme.surfaceVariant, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(painterResource(UiIcons.User), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    },
                )
                HorizontalDivider()
            }
            SectionTitle(R.string.nav_configuration)
            Entry(UiIcons.Flame, R.string.nav_habits, onOpenHabits)
            Entry(UiIcons.Dumbbell, R.string.nav_exercises, onOpenExercises)
            Entry(UiIcons.List, R.string.nav_lists, onOpenLists)
            HorizontalDivider(Modifier.padding(vertical = 8.dp))
            Entry(UiIcons.LogOut, R.string.nav_log_out, onSignOut, tint = MaterialTheme.colorScheme.error)
        }
    }
}

@Composable
private fun SectionTitle(@StringRes text: Int) {
    Text(
        text = stringResource(text),
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(start = 16.dp, top = 16.dp, bottom = 4.dp),
    )
}

@Composable
private fun Entry(@DrawableRes icon: Int, @StringRes label: Int, onClick: () -> Unit, tint: Color = Color.Unspecified) {
    ListItem(
        headlineContent = { Text(stringResource(label)) },
        leadingContent = { Icon(painterResource(icon), contentDescription = null) },
        colors = if (tint == Color.Unspecified) ListItemDefaults.colors() else ListItemDefaults.colors(headlineColor = tint, leadingIconColor = tint),
        modifier = Modifier.clickable(onClick = onClick),
    )
}
