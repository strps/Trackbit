package com.trackbit.core.database

import androidx.room.TypeConverter
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.ColorStopSerializer
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.MuscleGroupRef
import com.trackbit.core.model.QueueEmptyReason
import com.trackbit.core.model.serialization.TrackbitJson
import com.trackbit.core.model.serialization.WireEnum
import kotlinx.serialization.builtins.ListSerializer
import java.time.Instant
import java.time.LocalDate

/**
 * Server enums are stored by their wire string and read back through the same fallback
 * serializers as the API, so a value this build doesn't know stays `Unknown` (or `Star`).
 * `Unknown` has no wire string, so it is stored by its constant name. Wire strings are lowercase,
 * so that name is never one of them and reads back as the fallback again.
 */
internal class Converters {
    /** ISO `YYYY-MM-DD`, which sorts and compares correctly as text. */
    @TypeConverter fun localDateToString(value: LocalDate?): String? = value?.toString()
    @TypeConverter fun stringToLocalDate(value: String?): LocalDate? = value?.let(LocalDate::parse)

    @TypeConverter fun instantToMillis(value: Instant?): Long? = value?.toEpochMilli()
    @TypeConverter fun millisToInstant(value: Long?): Instant? = value?.let(Instant::ofEpochMilli)

    @TypeConverter fun colorStopsToJson(value: List<ColorStop>): String = TrackbitJson.encodeToString(colorStops, value)
    @TypeConverter fun jsonToColorStops(value: String): List<ColorStop> = TrackbitJson.decodeFromString(colorStops, value)

    @TypeConverter fun muscleGroupsToJson(value: List<MuscleGroupRef>): String = TrackbitJson.encodeToString(muscleGroups, value)
    @TypeConverter fun jsonToMuscleGroups(value: String): List<MuscleGroupRef> = TrackbitJson.decodeFromString(muscleGroups, value)

    @TypeConverter fun habitTypeToWire(value: HabitType): String = value.stored()
    @TypeConverter fun wireToHabitType(value: String): HabitType = HabitType.Serializer.fromWire(value)

    @TypeConverter fun colorThemeToWire(value: ColorTheme): String = value.stored()
    @TypeConverter fun wireToColorTheme(value: String): ColorTheme = ColorTheme.Serializer.fromWire(value)

    @TypeConverter fun habitIconToWire(value: HabitIcon): String = value.wire
    @TypeConverter fun wireToHabitIcon(value: String): HabitIcon = HabitIcon.Serializer.fromWire(value)

    @TypeConverter fun emptyReasonToWire(value: QueueEmptyReason?): String? = value?.stored()
    @TypeConverter fun wireToEmptyReason(value: String?): QueueEmptyReason? = value?.let(QueueEmptyReason.Serializer::fromWire)

    private fun <E> E.stored(): String where E : Enum<E>, E : WireEnum = wire ?: name

    private companion object {
        val colorStops = ListSerializer(ColorStopSerializer)
        val muscleGroups = ListSerializer(MuscleGroupRef.serializer())
    }
}
