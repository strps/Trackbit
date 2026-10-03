package com.trackbit.feature.analytics

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLocale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.designsystem.color.colorAt
import com.trackbit.core.designsystem.component.Heatmap
import com.trackbit.core.designsystem.format.displayText
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.HabitType
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.time.temporal.WeekFields

/** The web's `/stats`: one habit's stat cards and heatmap, plus the charts of a workout habit. */
@Composable
fun AnalyticsScreen(viewModel: AnalyticsViewModel = hiltViewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    state.message?.let { message ->
        val text = stringResource(message.textRes)
        LaunchedEffect(message) {
            snackbar.showSnackbar(text)
            viewModel.onMessageShown(message)
        }
    }

    AnalyticsContent(state, snackbar, onSelectHabit = viewModel::selectHabit, onRefresh = viewModel::refresh)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AnalyticsContent(
    state: AnalyticsUiState,
    snackbar: SnackbarHostState,
    onSelectHabit: (Int) -> Unit,
    onRefresh: () -> Unit,
) {
    Scaffold(
        topBar = { TopAppBar(title = { Text(stringResource(R.string.analytics_title)) }) },
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
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                val habit = state.habit
                when {
                    state.habits == null || state.today == null -> item { CenteredText(R.string.analytics_loading) }
                    state.habits.isEmpty() || habit == null -> item { CenteredText(R.string.tracker_empty) }
                    else -> {
                        item(key = "picker") { HabitPicker(state.habits, habit, onSelectHabit) }
                        item(key = "stats") { StatCards(state.stats) }
                        item(key = "heatmap") { HeatmapCard(habit, state.today) }
                        if (habit.type == HabitType.Complex) {
                            val sets = state.sets
                            if (sets == null) {
                                item(key = "charts-loading") { CenteredText(R.string.analytics_loading) }
                            } else {
                                // Keyed by habit, so a chart's controls reset when the habit changes.
                                item(key = "exercise-${habit.id}") {
                                    ExerciseChartCard(sets, state.exercises, state.unitSystem, state.today)
                                }
                                item(key = "volume-${habit.id}") {
                                    VolumeChartCard(sets, state.exercises, state.unitSystem, state.today)
                                }
                                item(key = "muscle-${habit.id}") {
                                    MuscleBalanceCard(sets, state.exercises, state.unitSystem, state.today)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HabitPicker(habits: List<TrackedHabit>, habit: TrackedHabit, onSelect: (Int) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(
            stringResource(R.string.analytics_habit_label),
            style = MaterialTheme.typography.labelLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Box {
            TextButton(onClick = { open = true }) {
                Text(
                    habit.name,
                    style = MaterialTheme.typography.titleMedium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.widthIn(max = 260.dp),
                )
                Icon(painterResource(UiIcons.ChevronDown), null, Modifier.padding(start = 4.dp).size(16.dp))
            }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                for (option in habits) {
                    DropdownMenuItem(
                        text = { Text(option.name) },
                        onClick = {
                            open = false
                            onSelect(option.id)
                        },
                    )
                }
            }
        }
    }
}

@Composable
private fun StatCards(stats: HabitStats?) {
    // Unknown until the habit's whole history is in Room.
    val dash = "–"
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        StatCard(
            title = stringResource(R.string.analytics_stat_total_completions),
            value = stats?.totalCompletions?.toString() ?: dash,
            icon = UiIcons.CircleCheck,
            tint = Color(0xFF10B981),
        )
        val streak = stats?.currentStreak
        StatCard(
            title = stringResource(R.string.analytics_stat_current_streak),
            value = streak?.toString() ?: dash,
            icon = UiIcons.Flame,
            tint = Color(0xFFF97316),
            trend = streak?.let {
                stringResource(if (it > 0) R.string.analytics_stat_streak_active else R.string.analytics_stat_streak_none)
            },
        )
        StatCard(
            title = stringResource(R.string.analytics_stat_goal_frequency),
            value = stats?.let { "${it.goalFrequencyPercent}%" } ?: dash,
            icon = UiIcons.BarChart,
            tint = Color(0xFF3B82F6),
            trend = stringResource(R.string.analytics_stat_goal_frequency_hint),
        )
    }
}

@Composable
private fun StatCard(title: String, value: String, @DrawableRes icon: Int, tint: Color, trend: String? = null) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                if (trend != null) {
                    Text(trend, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            Icon(painterResource(icon), null, tint = tint, modifier = Modifier.size(24.dp))
        }
    }
}

/** A year of the habit, colored like the widgets' heatmap; a tapped day shows its value. */
@Composable
private fun HeatmapCard(habit: TrackedHabit, today: LocalDate) {
    var selected by rememberSaveable(habit.id) { mutableStateOf(today.toString()) }
    val selectedDay = LocalDate.parse(selected)
    val byDay = remember(habit.recent) { habit.recent.associateBy { it.day } }
    val locale = LocalLocale.current.platformLocale
    val firstDayOfWeek = remember(locale) { WeekFields.of(locale).firstDayOfWeek }
    val error = MaterialTheme.colorScheme.error

    fun progressOf(day: LocalDate): HabitProgress = byDay[day].let { HabitProgress.of(habit, it?.rating, it?.sessionCount ?: 0) }

    ChartCard(
        icon = UiIcons.CalendarDays,
        tint = MaterialTheme.colorScheme.onSurfaceVariant,
        header = { Text(stringResource(R.string.analytics_heatmap_title), style = MaterialTheme.typography.titleSmall) },
    ) {
        Heatmap(
            today = today,
            weeks = AnalyticsViewModel.HEATMAP_DAYS / 7,
            firstDayOfWeek = firstDayOfWeek,
            // Anti-habits mark only slips, as on the widgets.
            colorOf = { day ->
                val progress = progressOf(day)
                when {
                    habit.isAntiHabit -> if (progress.value > 0) error else null
                    progress.fraction > 0f -> habit.colorStops.colorAt(progress.fraction)
                    else -> null
                }
            },
            selected = selectedDay,
            onSelect = { selected = it.toString() },
        )
        val progress = progressOf(selectedDay)
        val value = progress.displayText(habit.type) ?: if (progress.value > 0) "✓" else "–"
        Text(
            "${selectedDay.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))} · $value",
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

// --- Shared by the charts ---

/** A card like the web's chart panels: an icon and [header], then [controls], then [content]. */
@Composable
internal fun ChartCard(
    @DrawableRes icon: Int,
    tint: Color,
    header: @Composable () -> Unit,
    controls: (@Composable ColumnScope.() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit,
) {
    OutlinedCard(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(painterResource(icon), null, tint = tint, modifier = Modifier.size(20.dp))
                header()
            }
            controls?.invoke(this)
            content()
        }
    }
}

/** The web's `SegmentedControl`, as Material segmented buttons. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun <T> Segmented(options: List<Pair<T, String>>, selected: T, onSelect: (T) -> Unit, modifier: Modifier = Modifier) {
    SingleChoiceSegmentedButtonRow(modifier.fillMaxWidth()) {
        options.forEachIndexed { index, (value, label) ->
            SegmentedButton(
                selected = value == selected,
                onClick = { onSelect(value) },
                shape = SegmentedButtonDefaults.itemShape(index, options.size),
                icon = {},
                label = { Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1) },
            )
        }
    }
}

@Composable
internal fun rangeOptions(): List<Pair<TimeRange, String>> = listOf(
    TimeRange.OneMonth to stringResource(R.string.analytics_range_1m),
    TimeRange.ThreeMonths to stringResource(R.string.analytics_range_3m),
    TimeRange.SixMonths to stringResource(R.string.analytics_range_6m),
    TimeRange.OneYear to stringResource(R.string.analytics_range_1y),
    TimeRange.All to stringResource(R.string.analytics_range_all),
)

/** The summary figures above a chart. */
@Composable
internal fun Summary(items: List<Triple<String, String, Color?>>) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        for ((label, value, color) in items) {
            Column {
                Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    value,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = color ?: MaterialTheme.colorScheme.onSurface,
                )
            }
        }
    }
}

@Composable
internal fun CenteredText(@StringRes text: Int) = CenteredText(stringResource(text))

@Composable
internal fun CenteredText(text: String) {
    Text(
        text = text,
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.fillMaxWidth().padding(32.dp),
    )
}

@get:StringRes
private val AnalyticsMessage.textRes: Int
    get() = when (this) {
        AnalyticsMessage.Offline -> R.string.android_tracker_offline
        AnalyticsMessage.SyncFailed -> R.string.errors_generic_title
    }
