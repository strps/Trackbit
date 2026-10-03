package com.trackbit.feature.habitsconfig

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.designsystem.component.DurationDialog
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.designsystem.icon.painter
import com.trackbit.core.i18n.R
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.GradientPresets
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitRules
import com.trackbit.core.model.HabitType
import kotlin.math.roundToInt

/** Creates a habit, or edits the route's one: the web's habit drawer as a full screen. */
@Composable
fun HabitFormScreen(onDone: () -> Unit, viewModel: HabitFormViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.done) { if (state.done) onDone() }

    state.message?.let { message ->
        val text = message.text()
        LaunchedEffect(message) {
            snackbar.showSnackbar(text)
            viewModel.onMessageShown(message)
        }
    }

    HabitFormContent(
        state = state,
        snackbar = snackbar,
        onClose = onDone,
        onRetry = viewModel::load,
        onEdit = viewModel::edit,
        onType = viewModel::setType,
        onSave = viewModel::save,
        onDelete = viewModel::delete,
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HabitFormContent(
    state: HabitFormUiState,
    snackbar: SnackbarHostState,
    onClose: () -> Unit,
    onRetry: () -> Unit,
    onEdit: ((HabitForm) -> HabitForm) -> Unit,
    onType: (HabitType) -> Unit,
    onSave: () -> Unit,
    onDelete: () -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(stringResource(if (state.isNew) R.string.habits_drawer_new_title else R.string.habits_drawer_edit_title)) },
                navigationIcon = {
                    IconButton(onClick = onClose) {
                        Icon(painterResource(UiIcons.ArrowLeft), stringResource(R.string.habits_form_cancel))
                    }
                },
                actions = {
                    TextButton(onClick = onSave, enabled = state.canSave) { Text(stringResource(R.string.habits_form_save)) }
                },
            )
        },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->
        when {
            state.loading -> Box(Modifier.padding(padding).fillMaxSize(), contentAlignment = Alignment.Center) {
                Text(stringResource(R.string.common_loading), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            state.loadFailed -> Column(
                Modifier.padding(padding).fillMaxSize().padding(24.dp),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(stringResource(R.string.android_errors_offline), textAlign = TextAlign.Center)
                TextButton(onClick = onRetry) { Text(stringResource(R.string.android_retry)) }
            }
            else -> FormFields(state, onEdit, onType, onDelete, Modifier.padding(padding))
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FormFields(
    state: HabitFormUiState,
    onEdit: ((HabitForm) -> HabitForm) -> Unit,
    onType: (HabitType) -> Unit,
    onDelete: () -> Unit,
    modifier: Modifier,
) {
    val form = state.form
    val enabled = !state.frozen && !state.busy
    val problems = if (state.showProblems) form.problems else emptySet()

    Column(
        modifier.fillMaxSize().imePadding().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        if (state.frozen) FrozenBanner()

        OutlinedTextField(
            value = form.name,
            onValueChange = { name -> onEdit { it.copy(name = name) } },
            label = { Text(stringResource(R.string.habits_form_name)) },
            placeholder = { Text(stringResource(R.string.habits_form_name_placeholder)) },
            isError = HabitRules.Problem.NameLength in problems,
            supportingText = if (HabitRules.Problem.NameLength in problems) {
                {
                    Text(
                        if (form.name.trim().length < HabitRules.NAME_LENGTH.first) {
                            stringResource(R.string.common_validation_too_short, HabitRules.NAME_LENGTH.first)
                        } else {
                            stringResource(R.string.common_validation_too_long, HabitRules.NAME_LENGTH.last)
                        },
                    )
                }
            } else null,
            singleLine = true,
            enabled = enabled,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Sentences),
            modifier = Modifier.fillMaxWidth(),
        )

        Section(R.string.habits_form_tracking_method) {
            for (type in HabitRules.FORM_TYPES) {
                TypeOption(
                    type = type,
                    selected = form.type == type,
                    allowed = state.allows(type),
                    enabled = enabled,
                    onClick = { onType(type) },
                )
            }
        }

        if (HabitRules.canBeAntiHabit(form.type)) {
            AntiHabitSwitch(form.isAntiHabit, enabled) { anti -> onEdit { it.copy(isAntiHabit = anti) } }
        }

        Section(R.string.habits_form_weekly_goal) {
            GoalSlider(form.weeklyGoal, HabitRules.WEEKLY_GOAL, enabled) { goal -> onEdit { it.copy(weeklyGoal = goal) } }
        }

        when (form.type) {
            HabitType.Timed -> Section(R.string.habits_form_daily_goal_duration) {
                DurationGoal(form.dailyGoal, enabled, invalid = HabitRules.Problem.DailyGoal in problems) { minutes ->
                    onEdit { it.copy(dailyGoal = minutes) }
                }
            }
            HabitType.Check -> Unit
            else -> Section(R.string.habits_form_daily_goal_times) {
                GoalSlider(form.dailyGoal, HabitRules.COUNT_DAILY_GOAL, enabled) { goal -> onEdit { it.copy(dailyGoal = goal) } }
            }
        }

        HorizontalDivider()

        Section(R.string.habits_form_icon) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (icon in HabitIcon.entries) {
                    IconOption(icon, form.icon == icon, enabled) { onEdit { it.copy(icon = icon) } }
                }
            }
        }

        Section(R.string.habits_form_color_theme) {
            ThemePicker(form, enabled, onEdit)
        }

        if (!state.isNew) DeleteButton(form.name, enabled = !state.busy, onDelete)
    }
}

@Composable
private fun Section(title: Int, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(stringResource(title), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
        content()
    }
}

@Composable
private fun FrozenBanner() {
    Surface(color = MaterialTheme.colorScheme.tertiaryContainer, shape = RoundedCornerShape(12.dp)) {
        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(painterResource(UiIcons.Lock), contentDescription = null, modifier = Modifier.size(18.dp))
            Column {
                Text(stringResource(R.string.errors_limits_habit_frozen_title), fontWeight = FontWeight.SemiBold)
                Text(stringResource(R.string.errors_limits_habit_frozen_body), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun TypeOption(type: HabitType, selected: Boolean, allowed: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val border = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
    OutlinedCard(
        modifier = Modifier
            .fillMaxWidth()
            .selectable(selected = selected, enabled = enabled && allowed, role = Role.RadioButton, onClick = onClick),
        border = androidx.compose.foundation.BorderStroke(if (selected) 2.dp else 1.dp, border),
    ) {
        Row(
            Modifier.padding(12.dp).alpha(if (allowed) 1f else DISABLED_ALPHA),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                painterResource(if (type == HabitType.Complex) UiIcons.List else UiIcons.CircleCheck),
                contentDescription = null,
                modifier = Modifier.size(20.dp),
            )
            Column(Modifier.weight(1f)) {
                Text(stringResource(type.labelRes), fontWeight = FontWeight.Bold)
                Text(
                    stringResource(type.descriptionRes),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            if (!allowed) {
                Icon(
                    painterResource(UiIcons.Lock),
                    contentDescription = stringResource(R.string.errors_limits_habit_type_not_allowed_title),
                    modifier = Modifier.size(18.dp),
                )
            }
        }
    }
}

@Composable
private fun AntiHabitSwitch(checked: Boolean, enabled: Boolean, onChange: (Boolean) -> Unit) {
    OutlinedCard(Modifier.fillMaxWidth().toggleable(checked, enabled = enabled, role = Role.Switch, onValueChange = onChange)) {
        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(
                painterResource(UiIcons.ShieldAlert),
                contentDescription = null,
                tint = if (checked) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.size(20.dp),
            )
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.habits_form_anti_habit), fontWeight = FontWeight.Bold)
                Text(
                    stringResource(R.string.habits_form_anti_habit_description),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            // The card toggles; the switch only shows the state.
            Switch(checked = checked, onCheckedChange = null, enabled = enabled)
        }
    }
}

@Composable
private fun GoalSlider(value: Int, range: IntRange, enabled: Boolean, onChange: (Int) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Slider(
            value = value.coerceIn(range).toFloat(),
            onValueChange = { onChange(it.roundToInt()) },
            valueRange = range.first.toFloat()..range.last.toFloat(),
            // Discrete stops only where they're few enough to see.
            steps = if (range.last - range.first <= 10) range.last - range.first - 1 else 0,
            enabled = enabled,
            modifier = Modifier.weight(1f),
        )
        Text(value.toString(), style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(end = 4.dp))
    }
}

/** A timed habit's goal in minutes, edited with the shared minutes/seconds dialog. */
@Composable
private fun DurationGoal(minutes: Int, enabled: Boolean, invalid: Boolean, onChange: (Int) -> Unit) {
    var editing by rememberSaveable { mutableStateOf(false) }
    val title = stringResource(R.string.habits_form_daily_goal_duration)
    OutlinedButton(onClick = { editing = true }, enabled = enabled) {
        Icon(painterResource(UiIcons.Clock), contentDescription = null, modifier = Modifier.size(18.dp))
        Text(
            "${minutes / 60} ${stringResource(R.string.habits_form_duration_hours)} " +
                "${minutes % 60} ${stringResource(R.string.habits_form_duration_minutes)}",
            Modifier.padding(start = 8.dp),
        )
    }
    if (invalid) {
        Text(stringResource(R.string.habits_form_daily_goal_duration_min), color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
    }
    if (editing) {
        DurationDialog(
            title = title,
            initialMs = minutes * MS_PER_MINUTE,
            onDismiss = { editing = false },
            onSave = { ms ->
                // Whole minutes, as the goal is stored; seconds round to the nearest one.
                onChange(((ms + MS_PER_MINUTE / 2) / MS_PER_MINUTE).toInt().coerceIn(HabitRules.TIMED_DAILY_GOAL))
                editing = false
            },
        )
    }
}

@Composable
private fun IconOption(icon: HabitIcon, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Box(
        Modifier
            .size(48.dp)
            .clip(CircleShape)
            .background(if (selected) colors.primary else colors.surfaceVariant)
            .selectable(selected = selected, enabled = enabled, role = Role.RadioButton, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon.painter(), contentDescription = icon.wire, tint = if (selected) colors.onPrimary else colors.onSurfaceVariant)
    }
}

@Composable
private fun ThemePicker(form: HabitForm, enabled: Boolean, onEdit: ((HabitForm) -> HabitForm) -> Unit) {
    val presets = GradientPresets.keys.filter { it != ColorTheme.Custom }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for (pair in presets.chunked(2)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (theme in pair) {
                    ThemeOption(theme, form.colorTheme == theme, enabled, Modifier.weight(1f)) {
                        onEdit { it.copy(colorTheme = theme) }
                    }
                }
            }
        }
        val custom = form.colorTheme == ColorTheme.Custom
        ThemeCard(custom, enabled, onClick = { onEdit { it.copy(colorTheme = ColorTheme.Custom) } }, modifier = Modifier.fillMaxWidth()) {
            Swatch(form.colorStops)
            Text(stringResource(ColorTheme.Custom.labelRes), style = MaterialTheme.typography.labelLarge)
            if (custom) {
                GradientEditor(form.colorStops, onChange = { stops -> onEdit { it.copy(colorStops = stops) } }, enabled = enabled)
            }
        }
    }
}

@Composable
private fun ThemeOption(theme: ColorTheme, selected: Boolean, enabled: Boolean, modifier: Modifier, onClick: () -> Unit) {
    ThemeCard(selected, enabled, onClick, modifier) {
        Swatch(GradientPresets.getValue(theme))
        Text(stringResource(theme.labelRes), style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center)
    }
}

@Composable
private fun ThemeCard(
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier,
    content: @Composable () -> Unit,
) {
    val border = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant
    Column(
        modifier
            .clip(RoundedCornerShape(12.dp))
            .border(if (selected) 2.dp else 1.dp, border, RoundedCornerShape(12.dp))
            .clickable(enabled = enabled, role = Role.RadioButton, onClick = onClick)
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) { content() }
}

/** A gradient strip over an empty cell's color, like the web's `GradientPreview`. */
@Composable
private fun Swatch(stops: List<com.trackbit.core.model.ColorStop>) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(20.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(MaterialTheme.colorScheme.surfaceVariant)
            .background(gradientBrush(stops)),
    )
}

@Composable
private fun DeleteButton(name: String, enabled: Boolean, onDelete: () -> Unit) {
    var confirming by rememberSaveable { mutableStateOf(false) }
    OutlinedButton(
        onClick = { confirming = true },
        enabled = enabled,
        colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Icon(painterResource(UiIcons.Trash), contentDescription = null, modifier = Modifier.size(18.dp))
        Text(stringResource(R.string.habits_form_delete), Modifier.padding(start = 8.dp))
    }
    if (confirming) {
        AlertDialog(
            onDismissRequest = { confirming = false },
            title = { Text(stringResource(R.string.habits_form_delete_title, name)) },
            text = { Text(stringResource(R.string.habits_form_delete_body)) },
            confirmButton = {
                TextButton(
                    onClick = {
                        confirming = false
                        onDelete()
                    },
                    colors = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error),
                ) { Text(stringResource(R.string.habits_form_delete)) }
            },
            dismissButton = { TextButton(onClick = { confirming = false }) { Text(stringResource(R.string.habits_form_cancel)) } },
        )
    }
}

@Composable
private fun HabitFormMessage.text(): String = when (this) {
    HabitFormMessage.Offline -> stringResource(R.string.android_errors_offline)
    HabitFormMessage.Failed -> stringResource(R.string.errors_generic_title)
    HabitFormMessage.NotFound -> stringResource(R.string.android_habits_not_found)
    HabitFormMessage.HabitFrozen -> stringResource(R.string.errors_limits_habit_frozen_body)
    is HabitFormMessage.HabitLimitReached -> stringResource(R.string.errors_limits_habit_limit_reached_body, maxHabits)
    is HabitFormMessage.HabitTypeNotAllowed -> stringResource(
        R.string.errors_limits_habit_type_not_allowed_body,
        type?.let { stringResource(it.labelRes) }.orEmpty(),
        allowed.map { stringResource(it.labelRes) }.joinToString(", "),
    )
}

private const val MS_PER_MINUTE = 60_000L
