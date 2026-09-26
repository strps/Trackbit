package com.trackbit.core.model.serialization

import kotlinx.serialization.KSerializer
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import java.time.Instant
import java.time.LocalDate

/** A calendar day as `YYYY-MM-DD`, the format of `local_day` and every `day` parameter. */
object LocalDateSerializer : KSerializer<LocalDate> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("com.trackbit.LocalDate", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): LocalDate = LocalDate.parse(decoder.decodeString())

    override fun serialize(encoder: Encoder, value: LocalDate) = encoder.encodeString(value.toString())
}

/** An ISO-8601 instant, which is how the backend serializes every timestamp. */
object InstantSerializer : KSerializer<Instant> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("com.trackbit.Instant", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): Instant = Instant.parse(decoder.decodeString())

    override fun serialize(encoder: Encoder, value: Instant) = encoder.encodeString(value.toString())
}
