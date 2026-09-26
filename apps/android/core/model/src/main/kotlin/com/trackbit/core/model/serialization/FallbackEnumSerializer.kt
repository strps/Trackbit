package com.trackbit.core.model.serialization

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerializationException
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder

/** An enum whose constants map to the strings the backend uses. */
interface WireEnum {
    /** The string on the wire, or null for a client-only fallback that is never sent. */
    val wire: String?
}

/**
 * Decodes a string the app doesn't know (a value added on the server after this build) to
 * [fallback] instead of failing the whole response.
 */
abstract class FallbackEnumSerializer<E>(
    serialName: String,
    entries: List<E>,
    private val fallback: E,
) : KSerializer<E> where E : Enum<E>, E : WireEnum {
    private val byWire: Map<String, E> = entries.mapNotNull { e -> e.wire?.let { it to e } }.toMap()

    override val descriptor: SerialDescriptor = PrimitiveSerialDescriptor(serialName, PrimitiveKind.STRING)

    /** The constant for [wire], or the fallback when it is unknown or null. Also used to read Room columns. */
    fun fromWire(wire: String?): E = byWire[wire] ?: fallback

    override fun deserialize(decoder: Decoder): E = fromWire(decoder.decodeString())

    override fun serialize(encoder: Encoder, value: E) {
        val wire = value.wire ?: throw SerializationException("$value is a client-only fallback and cannot be sent")
        encoder.encodeString(wire)
    }
}
