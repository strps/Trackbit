package com.trackbit.feature.session

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.trackbit.core.data.RestTimer
import com.trackbit.core.designsystem.component.DurationDialog
import com.trackbit.core.designsystem.format.formatDuration
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import kotlinx.coroutines.delay
import java.time.Clock
import java.time.Instant

/**
 * The rest countdown at the foot of the session screen while it runs: time left, −15s / +15s,
 * Skip, and, when exact alarms aren't allowed, a link to allow them (the end alert is late
 * without). Hidden once the rest is over: the alarm's alert takes over.
 */
@Composable
internal fun RestTimerBar(rest: RestTimer?, onAdjust: (ms: Long) -> Unit, onSkip: () -> Unit) {
    rest ?: return
    val now by rememberCountdownNow(rest)
    if (rest.isOver(now)) return
    val remaining = rest.remainingMs(now)

    Surface(tonalElevation = 3.dp, shadowElevation = 3.dp) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(painterResource(UiIcons.Timer), contentDescription = null, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
                Text(stringResource(R.string.android_rest_title), style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.width(12.dp))
                // Rounded up, so it starts at the full rest and reads 0:01 in the last second.
                Text(
                    text = formatDuration((remaining + 999) / 1000 * 1000),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.weight(1f))
                Row(horizontalArrangement = Arrangement.spacedBy(0.dp)) {
                    TextButton(onClick = { onAdjust(-RestTimer.STEP_MS) }) { Text(stringResource(R.string.android_rest_minus_15s)) }
                    TextButton(onClick = { onAdjust(RestTimer.STEP_MS) }) { Text(stringResource(R.string.android_rest_plus_15s)) }
                    TextButton(onClick = onSkip) { Text(stringResource(R.string.android_rest_skip)) }
                }
            }
            LinearProgressIndicator(
                progress = { if (rest.totalMs > 0) remaining.toFloat() / rest.totalMs else 0f },
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
            )
            ExactAlarmHint()
        }
    }
}

/** The top bar's rest setting: "Rest 1:30" or "Rest off", editing the user's default rest. */
@Composable
internal fun DefaultRestButton(seconds: Int, onChange: (seconds: Int) -> Unit) {
    var editing by rememberSaveable { mutableStateOf(false) }
    TextButton(onClick = { editing = true }) {
        Icon(painterResource(UiIcons.Timer), contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(6.dp))
        Text(
            if (seconds > 0) {
                stringResource(R.string.android_rest_default, formatDuration(seconds * 1000L))
            } else {
                stringResource(R.string.android_rest_default_off)
            },
        )
    }
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

/** Shown while exact alarms are denied (12+; the default on 14+); checked again on every resume. */
@Composable
private fun ExactAlarmHint() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    val context = LocalContext.current
    val alarms = remember(context) { context.getSystemService(AlarmManager::class.java) }
    var allowed by remember { mutableStateOf(alarms.canScheduleExactAlarms()) }
    LifecycleResumeEffect(alarms) {
        allowed = alarms.canScheduleExactAlarms()
        onPauseOrDispose {}
    }
    if (allowed) return
    TextButton(onClick = { context.openExactAlarmSettings() }, modifier = Modifier.fillMaxWidth()) {
        Text(stringResource(R.string.android_rest_exact_alarm), style = MaterialTheme.typography.labelMedium)
    }
}

private fun Context.openExactAlarmSettings() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    startActivity(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, "package:$packageName".toUri()))
}

/** The current instant, re-read as each second of [rest] runs out, until it is over. */
@Composable
private fun rememberCountdownNow(rest: RestTimer, clock: Clock = Clock.systemUTC()) =
    produceState<Instant>(clock.instant(), rest) {
        value = clock.instant()
        while (!rest.isOver(value)) {
            val untilNextSecond = rest.remainingMs(value) % 1000
            delay(if (untilNextSecond == 0L) 1000 else untilNextSecond)
            value = clock.instant()
        }
    }
