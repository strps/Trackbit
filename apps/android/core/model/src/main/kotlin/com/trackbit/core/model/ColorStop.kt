package com.trackbit.core.model

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/** An RGBA color with 0–255 channels and a 0–1 alpha, as in `ColorStop.color`. */
data class Rgba(val red: Float, val green: Float, val blue: Float, val alpha: Float = 1f)

/** One stop of a habit's heatmap gradient. `position` runs from 0 to 1. */
@Serializable(with = ColorStopSerializer::class)
data class ColorStop(val position: Float, val color: Rgba)

/** The wire form: `{ position, color: [r, g, b] | [r, g, b, a] }`. */
@Serializable
private class ColorStopSurrogate(val position: Float, val color: List<Float>)

object ColorStopSerializer : KSerializer<ColorStop> {
    override val descriptor: SerialDescriptor =
        SerialDescriptor("com.trackbit.ColorStop", ColorStopSurrogate.serializer().descriptor)

    override fun deserialize(decoder: Decoder): ColorStop {
        val stop = decoder.decodeSerializableValue(ColorStopSurrogate.serializer())
        val c = stop.color
        val color = when (c.size) {
            3 -> Rgba(c[0], c[1], c[2])
            4 -> Rgba(c[0], c[1], c[2], c[3])
            else -> throw SerializationException("A color stop has 3 or 4 channels, got ${c.size}")
        }
        return ColorStop(stop.position, color)
    }

    override fun serialize(encoder: Encoder, value: ColorStop) {
        val c = value.color
        encoder.encodeSerializableValue(
            ColorStopSurrogate.serializer(),
            ColorStopSurrogate(value.position, listOf(c.red, c.green, c.blue, c.alpha)),
        )
    }
}
