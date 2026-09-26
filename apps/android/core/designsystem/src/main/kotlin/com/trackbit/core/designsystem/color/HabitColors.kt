package com.trackbit.core.designsystem.color

import androidx.compose.ui.graphics.Color
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.Rgba
import com.trackbit.core.model.colorAt

/** [Rgba]'s 0–255 channels as a Compose color. */
fun Rgba.toColor(): Color = Color(red / 255f, green / 255f, blue / 255f, alpha.coerceIn(0f, 1f))

/** The gradient's color at [t] (0–1), e.g. a heatmap cell for a day's progress fraction. */
fun List<ColorStop>.colorAt(t: Float): Color = colorAt(t).toColor()
