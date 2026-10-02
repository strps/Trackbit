package com.trackbit.feature.session

import androidx.annotation.StringRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.data.TrackedSession
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseLogCardStyle
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

/**
 * A workout habit's sessions on [day], like the web's activity tracker: each session's exercises,
 * their sets, and a picker to add exercises. Logs through the outbox, so it works offline.
 */
@Composable
fun SessionScreen(
    habitId: Int,
    day: LocalDate,
    onBack: () -> Unit,
    viewModel: SessionViewModel = hiltViewModel<SessionViewModel, SessionViewModel.Factory>(
        key = "$habitId/$day",
        creationCallback = { it.create(habitId, day) },
    ),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    state.message?.let { message ->
        val text = stringResource(message.textRes)
        LaunchedEffect(message) {
            snackbar.showSnackbar(text)
            viewModel.onMessageShown(message)
        }
    }

    val actions = remember(viewModel) {
        SessionActions(
            onStart = viewModel::startSession,
            onDelete = viewModel::deleteSession,
            onAddExercise = viewModel::addExercise,
            log = LogCardActions(
                onAddSet = viewModel::addSet,
                onUpdateSet = viewModel::updateSet,
                onDeleteSet = viewModel::deleteSet,
                onRemove = viewModel::removeExercise,
            ),
        )
    }
    SessionContent(state, snackbar, actions, onRefresh = viewModel::refresh, onBack = onBack)
}

private class SessionActions(
    val onStart: () -> Unit,
    val onDelete: (sessionId: String) -> Unit,
    val onAddExercise: (sessionId: String, exerciseId: Int) -> Unit,
    val log: LogCardActions,
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SessionContent(
    state: SessionUiState,
    snackbar: SnackbarHostState,
    actions: SessionActions,
    onRefresh: () -> Unit,
    onBack: () -> Unit,
) {
    // One log open for editing at a time, as on the web ("Start" … "Finish").
    var selectedLogId by rememberSaveable { mutableStateOf<String?>(null) }
    // The session whose picker is open.
    var pickingFor by rememberSaveable { mutableStateOf<String?>(null) }
    // The session an exercise was just added to, by its log count then: the new log opens.
    var addedTo by rememberSaveable { mutableStateOf<Pair<String, Int>?>(null) }
    LaunchedEffect(state.sessions, addedTo) {
        val (sessionId, before) = addedTo ?: return@LaunchedEffect
        val logs = state.sessions?.find { it.id == sessionId }?.logs ?: return@LaunchedEffect
        if (logs.size > before) {
            selectedLogId = logs.last().id
            addedTo = null
        }
    }
    val enabled = !state.readOnly

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(state.habit?.name ?: stringResource(R.string.tracker_activity_workout_session))
                        Text(
                            text = state.day.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(painterResource(UiIcons.ArrowLeft), stringResource(R.string.android_session_back))
                    }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.refreshing,
            onRefresh = onRefresh,
            modifier = Modifier.padding(padding).fillMaxSize(),
        ) {
            // Always a scrollable list, so pull-to-refresh works while loading or empty too.
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                if (state.readOnly) {
                    item { CenteredText(R.string.errors_limits_habit_frozen_body) }
                }
                val sessions = state.sessions
                when {
                    sessions == null -> item { CenteredText(R.string.tracker_activity_loading) }
                    sessions.isEmpty() -> item {
                        EmptyState(
                            title = R.string.tracker_activity_no_sessions_title,
                            description = R.string.tracker_activity_no_sessions_desc,
                            onClick = actions.onStart.takeIf { enabled },
                        )
                    }
                    else -> items(sessions, key = { it.id }) { session ->
                        SessionPanel(
                            session = session,
                            state = state,
                            selectedLogId = selectedLogId,
                            onSelectLog = { id, open -> selectedLogId = if (open) id else null },
                            onPick = { pickingFor = session.id },
                            enabled = enabled,
                            actions = actions,
                        )
                    }
                }
            }
        }
    }

    val picking = pickingFor?.let { id -> state.sessions?.find { it.id == id } }
    if (picking != null) {
        ExercisePickerSheet(
            exercises = state.exercises,
            onDismiss = { pickingFor = null },
            onPick = { exercise ->
                pickingFor = null
                addedTo = picking.id to picking.logs.size
                actions.onAddExercise(picking.id, exercise.id)
            },
        )
    }
}

/** A session: its header with delete, its exercises, and "Add exercise". */
@Composable
private fun SessionPanel(
    session: TrackedSession,
    state: SessionUiState,
    selectedLogId: String?,
    onSelectLog: (String, Boolean) -> Unit,
    onPick: () -> Unit,
    enabled: Boolean,
    actions: SessionActions,
) {
    Card(Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 16.dp, end = 4.dp, top = 8.dp, bottom = 8.dp)) {
            Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(8.dp)) {
                Icon(
                    painterResource(UiIcons.Dumbbell),
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                    modifier = Modifier.padding(8.dp).size(20.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Text(
                stringResource(R.string.tracker_activity_workout_session),
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.weight(1f),
            )
            SessionMenu(enabled) { actions.onDelete(session.id) }
        }
        HorizontalDivider()
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (session.logs.isEmpty()) {
                EmptyState(R.string.tracker_activity_empty_session_title, R.string.tracker_activity_empty_session_desc, onClick = null)
            }
            for (log in session.logs) {
                val exercise = state.exercise(log.exerciseId)
                // A frozen custom exercise is read-only too; the server refuses its sets.
                val logEnabled = enabled && exercise?.frozen != true
                if (state.cardStyle == ExerciseLogCardStyle.Compact) {
                    ExerciseLogCardCompact(log, exercise, state.unitSystem, logEnabled, actions.log)
                } else {
                    ExerciseLogCard(
                        log = log,
                        exercise = exercise,
                        units = state.unitSystem,
                        selected = log.id == selectedLogId,
                        onSelect = { onSelectLog(log.id, it) },
                        enabled = logEnabled,
                        actions = actions.log,
                    )
                }
            }
            if (enabled) {
                OutlinedButton(onClick = onPick, modifier = Modifier.align(Alignment.End)) {
                    Icon(painterResource(UiIcons.Plus), null, Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(stringResource(R.string.android_session_add_exercise))
                }
            }
        }
    }
}

@Composable
private fun SessionMenu(enabled: Boolean, onDelete: () -> Unit) {
    var open by remember { mutableStateOf(false) }
    Box {
        IconButton(onClick = { open = true }, enabled = enabled) {
            Icon(painterResource(UiIcons.MoreVertical), stringResource(R.string.android_tracker_more_options))
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            DropdownMenuItem(
                text = { Text(stringResource(R.string.tracker_activity_delete)) },
                leadingIcon = { Icon(painterResource(UiIcons.Trash), null, Modifier.size(18.dp)) },
                onClick = {
                    open = false
                    onDelete()
                },
            )
        }
    }
}

/**
 * The catalog, searched by name (the web picker's "All exercises" source). Frozen custom
 * exercises are shown locked. Lists, browse mode and "next" come with the full picker (D4).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ExercisePickerSheet(exercises: List<Exercise>, onDismiss: () -> Unit, onPick: (Exercise) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    val shown = remember(exercises, query) {
        val q = query.trim()
        if (q.isEmpty()) exercises else exercises.filter { it.name.contains(q, ignoreCase = true) }
    }
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)) {
        Text(
            stringResource(R.string.tracker_activity_select_exercise),
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(horizontal = 24.dp),
        )
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            placeholder = { Text(stringResource(R.string.tracker_activity_search_exercises)) },
            leadingIcon = { Icon(painterResource(UiIcons.Search), null, Modifier.size(18.dp)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        )
        LazyColumn(contentPadding = PaddingValues(bottom = 32.dp)) {
            if (shown.isEmpty()) item { CenteredText(R.string.tracker_activity_no_exercises_found) }
            items(shown, key = { it.id }) { exercise ->
                ListItem(
                    headlineContent = { Text(exercise.name) },
                    trailingContent = if (exercise.frozen) {
                        { Icon(painterResource(UiIcons.Lock), stringResource(R.string.errors_limits_custom_exercise_frozen_title), Modifier.size(18.dp)) }
                    } else {
                        null
                    },
                    modifier = Modifier.clickable(enabled = !exercise.frozen) { onPick(exercise) },
                )
            }
        }
    }
}

/** The web's EmptyState: a dashed prompt, tappable when [onClick] is set. */
@Composable
private fun EmptyState(@StringRes title: Int, @StringRes description: Int, onClick: (() -> Unit)?) {
    OutlinedCard(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier.fillMaxWidth().padding(24.dp),
        ) {
            Icon(painterResource(UiIcons.Dumbbell), null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(stringResource(title), style = MaterialTheme.typography.titleSmall, textAlign = TextAlign.Center)
            Text(
                stringResource(description),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
    }
}

@Composable
private fun CenteredText(@StringRes text: Int) {
    Text(
        text = stringResource(text),
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth().padding(24.dp),
    )
}

@get:StringRes
private val SessionMessage.textRes: Int
    get() = when (this) {
        SessionMessage.Offline -> R.string.android_tracker_offline
        SessionMessage.SyncFailed -> R.string.errors_generic_title
        SessionMessage.HabitFrozen -> R.string.errors_limits_habit_frozen_body
        SessionMessage.ExerciseFrozen -> R.string.errors_limits_custom_exercise_frozen_body
    }
