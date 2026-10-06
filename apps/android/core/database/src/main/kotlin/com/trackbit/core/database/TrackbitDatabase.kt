package com.trackbit.core.database

import androidx.room.AutoMigration
import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.trackbit.core.database.dao.ConfigDao
import com.trackbit.core.database.dao.DayLogDao
import com.trackbit.core.database.dao.ExerciseDao
import com.trackbit.core.database.dao.HabitDao
import com.trackbit.core.database.dao.HabitDayDao
import com.trackbit.core.database.dao.HabitSetDao
import com.trackbit.core.database.dao.HistoryDao
import com.trackbit.core.database.dao.OutboxDao
import com.trackbit.core.database.dao.SessionDao
import com.trackbit.core.database.dao.SourceDao
import com.trackbit.core.database.dao.SyncDao
import com.trackbit.core.database.dao.TimerDao
import com.trackbit.core.database.entity.ConfigPullEntity
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.ExerciseEntity
import com.trackbit.core.database.entity.ExerciseListEntity
import com.trackbit.core.database.entity.ExerciseListItemEntity
import com.trackbit.core.database.entity.ExerciseLogEntity
import com.trackbit.core.database.entity.ExerciseSourceEntity
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.database.entity.HabitSetEntity
import com.trackbit.core.database.entity.HabitSetPullEntity
import com.trackbit.core.database.entity.HistoryEntity
import com.trackbit.core.database.entity.LimitsEntity
import com.trackbit.core.database.entity.MuscleGroupEntity
import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.database.entity.PerformanceEntity
import com.trackbit.core.database.entity.QueueEntryEntity
import com.trackbit.core.database.entity.SessionEntity
import com.trackbit.core.database.entity.SourceQueueEntity
import com.trackbit.core.database.entity.TimerEntity

/**
 * The local cache the UI and widgets read (tracking and the whole config), plus the outbox of
 * unsent tracker writes. Habits, exercises, lists and their items are named by uuid ([Migrations]
 * has why version 9 starts empty). Schema changes need a migration: dropping the database would
 * lose the outbox.
 */
@Database(
    entities = [
        HabitEntity::class, DayLogEntity::class, OutboxEntity::class, TimerEntity::class, HistoryEntity::class,
        SessionEntity::class, ExerciseLogEntity::class, PerformanceEntity::class, ExerciseEntity::class,
        ExerciseSourceEntity::class, SourceQueueEntity::class, QueueEntryEntity::class,
        HabitSetEntity::class, HabitSetPullEntity::class, ExerciseListEntity::class, ExerciseListItemEntity::class,
        MuscleGroupEntity::class, LimitsEntity::class, ConfigPullEntity::class,
    ],
    version = 10,
    exportSchema = true,
    autoMigrations = [
        // The config tables; habits.summaryDay became nullable and habits/exercises gained columns.
        AutoMigration(from = 9, to = 10),
    ],
)
@TypeConverters(Converters::class)
abstract class TrackbitDatabase : RoomDatabase() {
    abstract fun habitDao(): HabitDao
    abstract fun dayLogDao(): DayLogDao
    abstract fun habitDayDao(): HabitDayDao
    abstract fun outboxDao(): OutboxDao
    abstract fun syncDao(): SyncDao
    abstract fun timerDao(): TimerDao
    abstract fun historyDao(): HistoryDao
    abstract fun sessionDao(): SessionDao
    abstract fun exerciseDao(): ExerciseDao
    abstract fun sourceDao(): SourceDao
    abstract fun habitSetDao(): HabitSetDao
    abstract fun configDao(): ConfigDao

    companion object {
        const val NAME = "trackbit.db"
    }
}
