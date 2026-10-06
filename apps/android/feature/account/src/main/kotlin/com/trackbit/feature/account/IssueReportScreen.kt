package com.trackbit.feature.account

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.IssueType
import kotlinx.coroutines.delay

/** How long the thanks shows before the screen closes, as the web's dialog. */
private const val SENT_CLOSE_DELAY_MS = 2_000L

/** The web's "Report a Bug" dialog as a screen (Settings → Report a Bug). */
@Composable
fun IssueReportScreen(onBack: () -> Unit, viewModel: IssueReportViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    if (state.sent) {
        LaunchedEffect(Unit) {
            delay(SENT_CLOSE_DELAY_MS)
            onBack()
        }
    }
    IssueReportContent(state, onBack, viewModel::selectType, viewModel::editDescription, viewModel::send)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun IssueReportContent(
    state: IssueReportUiState,
    onBack: () -> Unit,
    onType: (IssueType) -> Unit,
    onDescription: (String) -> Unit,
    onSend: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(R.string.issues_modal_title)) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(painterResource(UiIcons.ArrowLeft), stringResource(R.string.android_session_back))
                    }
                },
            )
        },
    ) { padding ->
        if (state.sent) {
            Sent(Modifier.padding(padding))
            return@Scaffold
        }
        Column(
            Modifier.padding(padding).fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                IssueType.entries.forEachIndexed { index, type ->
                    SegmentedButton(
                        selected = state.type == type,
                        onClick = { onType(type) },
                        shape = SegmentedButtonDefaults.itemShape(index, IssueType.entries.size),
                        icon = { Icon(painterResource(type.icon), contentDescription = null, Modifier.size(18.dp)) },
                    ) {
                        Text(stringResource(type.label))
                    }
                }
            }
            Text(stringResource(state.type.question), style = MaterialTheme.typography.titleSmall)
            OutlinedTextField(
                value = state.description,
                onValueChange = onDescription,
                placeholder = { Text(stringResource(state.type.placeholder)) },
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
                minLines = 4,
                modifier = Modifier.fillMaxWidth().heightIn(max = 320.dp),
            )
            // What the report says sent it, like the web's route line.
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(
                    painterResource(UiIcons.Smartphone),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(14.dp),
                )
                Text(
                    state.client,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            state.error?.let { error ->
                Text(
                    stringResource(
                        when (error) {
                            IssueReportError.Offline -> R.string.android_errors_offline
                            IssueReportError.Failed -> R.string.issues_modal_error
                        },
                    ),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            Button(onClick = onSend, enabled = state.canSend, modifier = Modifier.fillMaxWidth()) {
                Text(stringResource(if (state.sending) R.string.issues_modal_sending else R.string.issues_modal_send))
            }
        }
    }
}

@Composable
private fun Sent(modifier: Modifier) {
    Column(
        modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.CenterVertically),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Icon(
            painterResource(UiIcons.CircleCheck),
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(40.dp),
        )
        Text(stringResource(R.string.issues_modal_success_title), style = MaterialTheme.typography.titleLarge, textAlign = TextAlign.Center)
        Text(
            stringResource(R.string.issues_modal_success_message),
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

private val IssueType.icon get() = when (this) {
    IssueType.Bug -> UiIcons.Bug
    IssueType.Feedback -> UiIcons.MessageSquare
}

private val IssueType.label get() = when (this) {
    IssueType.Bug -> R.string.issues_type_bug_label
    IssueType.Feedback -> R.string.issues_type_feedback_label
}

private val IssueType.question get() = when (this) {
    IssueType.Bug -> R.string.issues_type_bug_question
    IssueType.Feedback -> R.string.issues_type_feedback_question
}

private val IssueType.placeholder get() = when (this) {
    IssueType.Bug -> R.string.issues_type_bug_placeholder
    IssueType.Feedback -> R.string.issues_type_feedback_placeholder
}
