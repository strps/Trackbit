package com.trackbit.core.database

import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.RecentDay
import com.trackbit.core.model.Rgba
import com.trackbit.core.model.TodayHabit
import com.trackbit.core.model.TodayResponse
import org.junit.After
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.LocalDate

/** An in-memory [TrackbitDatabase] per test. */
@RunWith(RobolectricTestRunner::class)
abstract class DatabaseTest {
    protected val db: TrackbitDatabase = Room
        .inMemoryDatabaseBuilder(ApplicationProvider.getApplicationContext(), TrackbitDatabase::class.java)
        .allowMainThreadQueries()
        .build()

    @After fun closeDb() = db.close()

    protected suspend fun insertHabits(vararg habits: HabitEntity) {
        db.syncDao().applyToday(
            TodayResponse(
                day = DAY,
                habits = habits.map { it.toTodayHabit() },
            ),
        )
    }

    companion object {
        val DAY: LocalDate = LocalDate.of(2026, 9, 26)

        fun habit(
            id: Int,
            order: Int = 0,
            type: HabitType = HabitType.Count,
            isAntiHabit: Boolean = false,
            firstLogDay: LocalDate? = null,
        ) = HabitEntity(
            id = id,
            name = "Habit $id",
            description = null,
            type = type,
            isAntiHabit = isAntiHabit,
            icon = HabitIcon.Book,
            colorTheme = ColorTheme.Green,
            colorStops = listOf(ColorStop(0f, Rgba(1f, 2f, 3f, 0.5f))),
            dailyGoal = 1,
            weeklyGoal = 5,
            order = order,
            frozen = false,
            firstLogDay = firstLogDay,
            streakBeforeDay = 0,
            summaryDay = DAY,
        )

        fun HabitEntity.toTodayHabit(recent: List<RecentDay> = emptyList()) = TodayHabit(
            id = id,
            name = name,
            description = description,
            type = type,
            isAntiHabit = isAntiHabit,
            icon = icon,
            colorTheme = colorTheme,
            colorStops = colorStops,
            dailyGoal = dailyGoal,
            weeklyGoal = weeklyGoal,
            order = order,
            frozen = frozen,
            firstLogDay = firstLogDay,
            streakBeforeDay = streakBeforeDay,
            recent = recent,
        )
    }
}
