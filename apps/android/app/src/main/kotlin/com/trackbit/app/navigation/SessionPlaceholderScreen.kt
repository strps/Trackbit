package com.trackbit.app.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R

/** Stands in for the workout session until `feature/session` exists (Phase 2, D3). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun SessionPlaceholderScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.tracker_activity_workout_session)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(painterResource(UiIcons.ArrowLeft), contentDescription = null)
                    }
                },
            )
        },
    ) { padding ->
        Text(
            text = stringResource(R.string.android_session_coming_soon),
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.padding(padding).padding(24.dp).fillMaxSize(),
        )
    }
}
