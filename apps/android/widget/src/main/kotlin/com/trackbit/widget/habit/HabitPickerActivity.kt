package com.trackbit.widget.habit

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.annotation.StringRes
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ListItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewModelScope
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.designsystem.color.colorAt
import com.trackbit.core.designsystem.icon.painter
import com.trackbit.core.designsystem.theme.TrackbitTheme
import com.trackbit.core.i18n.R as I18nR
import com.trackbit.widget.WidgetDay
import com.trackbit.widget.heatmap.HeatmapWidget
import com.trackbit.widget.heatmap.HeatmapWidgetReceiver
import com.trackbit.widget.quicklog.QuickLogWidget
import com.trackbit.widget.quicklog.QuickLogWidgetReceiver
import com.trackbit.widget.today.TodayWidgetState
import com.trackbit.widget.today.todayWidgetState
import com.trackbit.widget.ui.detailsText
import dagger.hilt.android.AndroidEntryPoint
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The habit picker of every habit widget (W1, W3). The launcher opens it when the widget is
 * placed (backing out removes the widget) and on reconfigure (Android 12+); the widget opens it
 * too once its habit is gone.
 */
@AndroidEntryPoint
class HabitPickerActivity : ComponentActivity() {
    private val viewModel: HabitPickerViewModel by viewModels()
    private var choosing = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
        setResult(RESULT_CANCELED, result(appWidgetId))
        // Exported for the launcher, so anyone can start it: only configure our own widgets.
        val provider = AppWidgetManager.getInstance(this).getAppWidgetInfo(appWidgetId)?.provider
        val widget = provider?.let(::habitWidgetFor)
        if (widget == null) {
            finish()
            return
        }
        enableEdgeToEdge()
        setContent {
            val state by viewModel.state.collectAsStateWithLifecycle()
            TrackbitTheme { HabitPicker(state, onPick = { choose(widget, appWidgetId, it) }) }
        }
    }

    /** The habit widget [provider] renders, if it is one of ours. */
    private fun habitWidgetFor(provider: ComponentName): GlanceAppWidget? = when (provider) {
        ComponentName(this, QuickLogWidgetReceiver::class.java) -> QuickLogWidget()
        ComponentName(this, HeatmapWidgetReceiver::class.java) -> HeatmapWidget()
        else -> null
    }

    private fun choose(widget: GlanceAppWidget, appWidgetId: Int, habit: TrackedHabit) {
        if (choosing) return
        choosing = true
        lifecycleScope.launch {
            val glanceId = GlanceAppWidgetManager(this@HabitPickerActivity).getGlanceIdBy(appWidgetId)
            widget.chooseHabit(applicationContext, glanceId, habit.uuid)
            setResult(RESULT_OK, result(appWidgetId))
            finish()
        }
    }

    private fun result(appWidgetId: Int) = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)

    companion object {
        internal fun intent(context: Context, appWidgetId: Int): Intent =
            Intent(context, HabitPickerActivity::class.java)
                .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
    }
}

/** The habits on the widget's day, or the signed-out state; null while loading. */
@HiltViewModel
internal class HabitPickerViewModel @Inject constructor(
    tracker: TrackerRepository,
    auth: AuthRepository,
    widgetDay: WidgetDay,
) : ViewModel() {
    val state: StateFlow<TodayWidgetState?> = todayWidgetState(auth.state, widgetDay.today, tracker)
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    init {
        widgetDay.refresh()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun HabitPicker(state: TodayWidgetState?, onPick: (TrackedHabit) -> Unit) {
    Scaffold(
        topBar = { TopAppBar(title = { Text(stringResource(I18nR.string.android_widget_choose_habit)) }) },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when {
                state == null -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                state is TodayWidgetState.SignedOut -> CenteredText(I18nR.string.android_widget_sign_in)
                state is TodayWidgetState.Tracking && state.habits.isEmpty() -> CenteredText(I18nR.string.tracker_empty)
                state is TodayWidgetState.Tracking -> LazyColumn {
                    items(state.habits, key = { it.uuid }) { habit -> HabitItem(habit, onPick) }
                }
            }
        }
    }
}

@Composable
private fun HabitItem(habit: TrackedHabit, onPick: (TrackedHabit) -> Unit) {
    val context = LocalContext.current
    ListItem(
        modifier = Modifier.clickable { onPick(habit) },
        leadingContent = {
            Icon(
                painter = habit.icon.painter(),
                contentDescription = null,
                tint = habit.colorStops.colorAt(1f),
                modifier = Modifier.size(28.dp),
            )
        },
        headlineContent = { Text(habit.name) },
        supportingContent = habit.detailsText(context)?.let { details -> { Text(details) } },
    )
}

@Composable
private fun BoxScope.CenteredText(@StringRes text: Int) {
    Text(
        text = stringResource(text),
        textAlign = TextAlign.Center,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.align(Alignment.Center).padding(32.dp),
    )
}
