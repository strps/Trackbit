package com.trackbit.core.model

/**
 * The color at [t] (clamped to 0–1) along a gradient, interpolating linearly between the stops
 * around it. Ports the web's `mapValueToColorOrdered`, so heatmaps match; stops may be in any order.
 */
fun List<ColorStop>.colorAt(t: Float): Rgba {
    require(isNotEmpty()) { "A gradient needs at least one stop" }
    val stops = sortedBy { it.position }
    val x = t.coerceIn(0f, 1f)
    if (x <= stops.first().position) return stops.first().color
    if (x >= stops.last().position) return stops.last().color
    val end = stops.indexOfFirst { it.position >= x }
    val a = stops[end - 1]
    val b = stops[end]
    val f = (x - a.position) / (b.position - a.position)
    fun lerp(from: Float, to: Float) = from + f * (to - from)
    return Rgba(
        red = lerp(a.color.red, b.color.red),
        green = lerp(a.color.green, b.color.green),
        blue = lerp(a.color.blue, b.color.blue),
        alpha = lerp(a.color.alpha, b.color.alpha),
    )
}
