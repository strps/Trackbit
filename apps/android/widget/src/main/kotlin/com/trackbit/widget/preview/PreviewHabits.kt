package com.trackbit.widget.preview

import android.content.Context
import com.trackbit.core.data.RECENT_DAYS
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.i18n.R as I18nR
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.GradientPresets
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.RecentDay
import java.time.LocalDate
import java.util.UUID
import kotlin.random.Random

/**
 * The sample habits in the widget picker's generated previews (Android 15+). They're sample data,
 * not the user's: the picker shows a preview before any widget exists, and the system keeps it
 * until the app publishes another. The static previewLayouts (Android 12–14) show the same habits.
 */
internal object PreviewHabits {
    /** No preview shows its date. A fixed one renders the same preview on every publish. */
    val DAY: LocalDate = LocalDate.of(2026, 9, 30)

    private const val MINUTE_MS = 60_000L
    private const val WATER_GOAL = 8
    private const val WATER_STREAK = 12

    /** W2: a count, a check that's done, and a timed habit under way. */
    fun today(context: Context): List<TrackedHabit> = listOf(water(context), read(context), meditate(context))

    /** Count, 5 of 8 today, on a 12-day streak; [days] of history (W1's week, W3's months). */
    fun water(context: Context, days: Int = RECENT_DAYS): TrackedHabit = sample(
        id = 1,
        name = context.getString(I18nR.string.android_widget_preview_water),
        type = HabitType.Count,
        icon = HabitIcon.Water,
        theme = ColorTheme.Blue,
        goal = WATER_GOAL,
        progress = HabitProgress(value = 5, goal = WATER_GOAL.toLong(), isAntiHabit = false),
        ratings = waterRatings(days),
        streak = WATER_STREAK,
    )

    private fun read(context: Context): TrackedHabit = sample(
        id = 2,
        name = context.getString(I18nR.string.android_widget_preview_read),
        type = HabitType.Check,
        icon = HabitIcon.Book,
        theme = ColorTheme.Purple,
        goal = 1,
        progress = HabitProgress(value = 1, goal = 1, isAntiHabit = false),
        ratings = List(RECENT_DAYS) { 1 },
        streak = 4,
    )

    /** Timed, 10 of 15 minutes. */
    private fun meditate(context: Context): TrackedHabit = sample(
        id = 3,
        name = context.getString(I18nR.string.android_widget_preview_meditate),
        type = HabitType.Timed,
        icon = HabitIcon.Heart,
        theme = ColorTheme.Green,
        goal = 15,
        progress = HabitProgress(value = 10 * MINUTE_MS, goal = 15 * MINUTE_MS, isAntiHabit = false),
        ratings = List(RECENT_DAYS - 1) { null } + (10 * MINUTE_MS).toInt(),
        streak = 1,
    )

    /**
     * Mostly full days, the last [WATER_STREAK] all logged, with today at 5. Seeded, so every
     * publish draws the same heatmap.
     */
    private fun waterRatings(days: Int): List<Int?> {
        val random = Random(seed = 7)
        return List(days) { index ->
            val fromToday = days - 1 - index
            when {
                fromToday == 0 -> 5
                fromToday < WATER_STREAK -> random.nextInt(4, WATER_GOAL + 1)
                fromToday == WATER_STREAK || random.nextFloat() < 0.2f -> null
                else -> random.nextInt(1, WATER_GOAL + 1)
            }
        }
    }

    private fun sample(
        id: Int,
        name: String,
        type: HabitType,
        icon: HabitIcon,
        theme: ColorTheme,
        goal: Int,
        progress: HabitProgress,
        ratings: List<Int?>,
        streak: Int,
    ) = TrackedHabit(
        uuid = UUID(0, id.toLong()).toString(),
        name = name,
        description = null,
        type = type,
        isAntiHabit = false,
        icon = icon,
        colorTheme = theme,
        colorStops = GradientPresets.getValue(theme),
        dailyGoal = goal,
        weeklyGoal = 7,
        frozen = false,
        day = DAY,
        recent = ratings.mapIndexed { index, rating ->
            RecentDay(DAY.minusDays(ratings.size - 1L - index), rating, sessionCount = 0)
        },
        progress = progress,
        streak = streak,
    )
}
