package com.trackbit.core.database.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.Habit
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.TodayHabit
import com.trackbit.core.model.TrackableHabit
import com.trackbit.core.model.resolveColorStops
import java.time.LocalDate

/**
 * A habit, named by its uuid like everything on the app. Two pulls feed it: `GET /api/tracker/today`
 * (the config plus the tracker's summary) and `GET /api/habits` (the config as the form edits it,
 * [ownColorStops] included). Each writes only its own columns, so neither undoes the other.
 */
@Entity(tableName = HabitEntity.TABLE)
data class HabitEntity(
    @PrimaryKey val uuid: String,
    val name: String,
    val description: String?,
    override val type: HabitType,
    override val isAntiHabit: Boolean,
    val icon: HabitIcon,
    val colorTheme: ColorTheme,
    /** Resolved: the preset's stops, or the habit's own for [ColorTheme.Custom]. */
    val colorStops: List<ColorStop>,
    /**
     * The habit's own stops, which the form keeps while a preset is picked. Empty until
     * `/api/habits` brought them, unless the theme is [ColorTheme.Custom] (then they are [colorStops]).
     */
    @ColumnInfo(defaultValue = "[]") val ownColorStops: List<ColorStop>,
    override val dailyGoal: Int,
    val weeklyGoal: Int,
    val order: Int,
    val frozen: Boolean,
    /** The earliest day with a log, server-side or pending. Null means never logged. */
    val firstLogDay: LocalDate?,
    /** The server's streak ending the day before [summaryDay]. */
    val streakBeforeDay: Int,
    /**
     * The day the summary was fetched for. [streakBeforeDay] is only valid for this day. Null
     * until a `/today` pull has summarized the habit: its streak is unknown until then.
     */
    val summaryDay: LocalDate?,
) : TrackableHabit {
    /** The habit as the config screens show it. */
    fun toHabit() = Habit(
        uuid = uuid,
        name = name,
        description = description,
        type = type,
        isAntiHabit = isAntiHabit,
        colorTheme = colorTheme,
        colorStops = ownColorStops,
        icon = icon,
        weeklyGoal = weeklyGoal,
        dailyGoal = dailyGoal,
        order = order,
        frozen = frozen,
    )

    companion object {
        const val TABLE = "habits"
    }
}

/** [local] is Room's row for the habit, whose [HabitEntity.ownColorStops] `/today` doesn't send. */
fun TodayHabit.toEntity(summaryDay: LocalDate, local: HabitEntity?) = HabitEntity(
    uuid = uuid,
    name = name,
    description = description,
    type = type,
    isAntiHabit = isAntiHabit,
    icon = icon,
    colorTheme = colorTheme,
    colorStops = colorStops,
    ownColorStops = if (colorTheme == ColorTheme.Custom) colorStops else local?.ownColorStops.orEmpty(),
    dailyGoal = dailyGoal,
    weeklyGoal = weeklyGoal,
    order = order,
    frozen = frozen,
    firstLogDay = firstLogDay,
    streakBeforeDay = streakBeforeDay,
    summaryDay = summaryDay,
)

/**
 * [local] is Room's row for the habit: its tracker summary, which `/api/habits` doesn't send, is
 * kept. A habit Room doesn't have yet starts unsummarized.
 */
fun Habit.toEntity(local: HabitEntity?) = HabitEntity(
    uuid = uuid,
    name = name,
    description = description,
    type = type,
    isAntiHabit = isAntiHabit,
    icon = icon,
    colorTheme = colorTheme,
    colorStops = resolveColorStops(colorTheme, colorStops),
    ownColorStops = colorStops,
    dailyGoal = dailyGoal,
    weeklyGoal = weeklyGoal,
    order = order,
    frozen = frozen,
    firstLogDay = local?.firstLogDay,
    streakBeforeDay = local?.streakBeforeDay ?: 0,
    summaryDay = local?.summaryDay,
)
