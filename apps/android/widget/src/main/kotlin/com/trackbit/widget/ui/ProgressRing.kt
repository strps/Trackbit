package com.trackbit.widget.ui

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import androidx.annotation.ColorInt
import androidx.compose.runtime.Composable
import androidx.core.graphics.createBitmap
import androidx.glance.ColorFilter
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.ContentScale
import androidx.glance.layout.fillMaxSize
import androidx.glance.unit.ColorProvider
import com.trackbit.widget.R

/**
 * A progress ring filling whatever space it's given, with [content] (an icon) in the middle.
 * Glance only has an indeterminate circular indicator, so the track is a tinted vector (it
 * follows the theme) and the arc a bitmap in the habit's color, drawn to the track's geometry.
 */
@Composable
internal fun ProgressRing(
    fraction: Float,
    @ColorInt color: Int,
    trackColor: ColorProvider,
    modifier: GlanceModifier = GlanceModifier,
    content: @Composable () -> Unit,
) {
    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Image(
            provider = ImageProvider(R.drawable.ic_widget_ring_track),
            contentDescription = null,
            colorFilter = ColorFilter.tint(trackColor),
            contentScale = ContentScale.Fit,
            modifier = GlanceModifier.fillMaxSize(),
        )
        if (fraction > 0f) {
            Image(
                provider = ImageProvider(ringArc(fraction, color)),
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = GlanceModifier.fillMaxSize(),
            )
        }
        content()
    }
}

/** Matches `ic_widget_ring_track`: a 48-unit viewport with a 4-unit stroke on a radius of 21. */
private const val VIEWPORT = 48f
private const val RADIUS = 21f
private const val STROKE = 4f

/** Large enough to stay sharp at a 2×2 widget's ring size on xxxhdpi. */
private const val ARC_PX = 288

/** The arc clockwise from 12 o'clock, [fraction] (clamped to 0–1) of the way round. */
internal fun ringArc(fraction: Float, @ColorInt color: Int, sizePx: Int = ARC_PX): Bitmap {
    val bitmap = createBitmap(sizePx, sizePx)
    val scale = sizePx / VIEWPORT
    val inset = (VIEWPORT / 2 - RADIUS) * scale
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = STROKE * scale
        strokeCap = Paint.Cap.ROUND
        this.color = color
    }
    Canvas(bitmap).drawArc(
        RectF(inset, inset, sizePx - inset, sizePx - inset),
        -90f,
        360f * fraction.coerceIn(0f, 1f),
        false,
        paint,
    )
    return bitmap
}
