package com.trackbit.feature.habitsconfig

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.trackbit.core.designsystem.color.toColor
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.colorAt
import kotlin.math.roundToInt

/** A gradient's colors left to right, for a preview bar or swatch. */
internal fun gradientBrush(stops: List<ColorStop>): Brush {
    val sorted = stops.sortedBy { it.position }
    return if (sorted.size == 1) {
        Brush.horizontalGradient(listOf(sorted[0].color.toColor(), sorted[0].color.toColor()))
    } else {
        Brush.horizontalGradient(*sorted.map { it.position.coerceIn(0f, 1f) to it.color.toColor() }.toTypedArray())
    }
}

/**
 * Edits a custom gradient like the web's `GradientPicker`: tap the bar to add a stop there, drag a
 * stop's handle to move it, and set the selected stop's RGBA and position below. A gradient keeps
 * at least one stop (the server requires one).
 */
@Composable
internal fun GradientEditor(stops: List<ColorStop>, onChange: (List<ColorStop>) -> Unit, enabled: Boolean) {
    var selected by rememberSaveable { mutableIntStateOf(0) }
    val index = selected.coerceIn(stops.indices)
    val current by rememberUpdatedState(stops)

    fun update(i: Int, change: (ColorStop) -> ColorStop) =
        onChange(current.mapIndexed { j, stop -> if (j == i) change(stop) else stop })

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        BoxWithConstraints(Modifier.fillMaxWidth().height(HANDLE_SIZE + BAR_HEIGHT)) {
            val widthPx = constraints.maxWidth.toFloat()
            val handlePx = with(LocalDensity.current) { HANDLE_SIZE.toPx() }
            Canvas(
                Modifier
                    .fillMaxWidth()
                    .height(BAR_HEIGHT)
                    .offset(y = HANDLE_SIZE / 2)
                    .clip(RoundedCornerShape(8.dp))
                    .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(8.dp))
                    .pointerInput(enabled) {
                        if (!enabled) return@pointerInput
                        detectTapGestures { offset ->
                            val position = (offset.x / size.width).coerceIn(0f, 1f)
                            onChange(current + ColorStop(position, current.colorAt(position)))
                            selected = current.size
                        }
                    },
            ) { drawRect(gradientBrush(stops)) }

            stops.forEachIndexed { i, stop ->
                val x = with(LocalDensity.current) { (stop.position * widthPx - handlePx / 2).toDp() }
                Box(
                    Modifier
                        .offset(x = x)
                        .size(HANDLE_SIZE)
                        .clip(CircleShape)
                        .border(if (i == index) 3.dp else 2.dp, if (i == index) MaterialTheme.colorScheme.primary else Color.White, CircleShape)
                        .border(1.dp, Color.Black.copy(alpha = 0.3f), CircleShape)
                        .pointerInput(enabled, i) {
                            if (!enabled) return@pointerInput
                            detectTapGestures { selected = i }
                        }
                        .pointerInput(enabled, i) {
                            if (!enabled) return@pointerInput
                            detectHorizontalDragGestures(onDragStart = { selected = i }) { change, dx ->
                                change.consume()
                                update(i) { it.copy(position = (it.position + dx / widthPx).coerceIn(0f, 1f)) }
                            }
                        },
                ) {
                    Canvas(Modifier.size(HANDLE_SIZE)) { drawCircle(stop.color.toColor().copy(alpha = 1f), radius = size.minDimension / 2 - 3.dp.toPx(), center = Offset(size.width / 2, size.height / 2)) }
                }
            }
        }

        val stop = stops[index]
        ChannelSlider(stringResource(R.string.android_habits_position), stop.position * 100, 0f..100f, enabled) { value ->
            update(index) { it.copy(position = value / 100) }
        }
        ChannelSlider("R", stop.color.red, 0f..255f, enabled) { v -> update(index) { it.copy(color = it.color.copy(red = v)) } }
        ChannelSlider("G", stop.color.green, 0f..255f, enabled) { v -> update(index) { it.copy(color = it.color.copy(green = v)) } }
        ChannelSlider("B", stop.color.blue, 0f..255f, enabled) { v -> update(index) { it.copy(color = it.color.copy(blue = v)) } }
        ChannelSlider("A", stop.color.alpha * 100, 0f..100f, enabled) { v -> update(index) { it.copy(color = it.color.copy(alpha = v / 100)) } }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(
                enabled = enabled,
                onClick = {
                    // Halfway between the selected stop and its right neighbour (or the end).
                    val sorted = current.sortedBy { it.position }
                    val next = sorted.firstOrNull { it.position > stop.position }?.position ?: 1f
                    val position = (stop.position + next) / 2
                    onChange(current + ColorStop(position, current.colorAt(position)))
                    selected = current.size
                },
            ) {
                Icon(painterResource(UiIcons.Plus), contentDescription = null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.android_habits_add_stop), Modifier.offset(x = 4.dp))
            }
            TextButton(
                enabled = enabled && stops.size > 1,
                onClick = {
                    onChange(current.filterIndexed { i, _ -> i != index })
                    selected = (index - 1).coerceAtLeast(0)
                },
            ) {
                Icon(painterResource(UiIcons.Trash), contentDescription = null, modifier = Modifier.size(18.dp))
                Text(stringResource(R.string.habits_gradient_delete_stop), Modifier.offset(x = 4.dp))
            }
        }
    }
}

@Composable
private fun ChannelSlider(label: String, value: Float, range: ClosedFloatingPointRange<Float>, enabled: Boolean, onChange: (Float) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium, modifier = Modifier.width(64.dp))
        Slider(
            value = value.coerceIn(range),
            onValueChange = { onChange(it.roundToInt().toFloat()) },
            valueRange = range,
            enabled = enabled,
            modifier = Modifier.weight(1f),
        )
        Text(value.roundToInt().toString(), style = MaterialTheme.typography.labelMedium, modifier = Modifier.width(36.dp))
    }
}

private val BAR_HEIGHT = 32.dp
private val HANDLE_SIZE = 28.dp
