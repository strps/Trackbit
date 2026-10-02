package com.trackbit.core.database

import androidx.room.AutoMigration
import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.trackbit.core.database.dao.DayLogDao
import com.trackbit.core.database.dao.ExerciseDao
import com.trackbit.core.database.dao.HabitDao
import com.trackbit.core.database.dao.HabitDayDao
import com.trackbit.core.database.dao.HistoryDao
import com.trackbit.core.database.dao.OutboxDao
import com.trackbit.core.database.dao.SessionDao
import com.trackbit.core.database.dao.SyncDao
import com.trackbit.core.database.dao.TimerDao
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.ExerciseEntity
import com.trackbit.core.database.entity.ExerciseLogEntity
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.database.entity.HistoryEntity
import com.trackbit.core.database.entity.OutboxEntity
import com.trackbit.core.database.entity.PerformanceEntity
import com.trackbit.core.database.entity.SessionEntity
import com.trackbit.core.database.entity.TimerEntity

/**
 * The local cache the UI and widgets read, plus the outbox of unsent tracker writes.
 * Schema changes need a migration: dropping the database would lose the outbox.
 */
@Database(
    entities = [
        HabitEntity::class, DayLogEntity::class, OutboxEntity::class, TimerEntity::class, HistoryEntity::class,
        SessionEntity::class, ExerciseLogEntity::class, PerformanceEntity::class, ExerciseEntity::class,
    ],
    version = 5,
    exportSchema = true,
    autoMigrations = [
        // 2: timers.
        AutoMigration(from = 1, to = 2),
        // 3: history.
        AutoMigration(from = 2, to = 3),
        // 4: history per owner, in Migrations.
        // 5: exercise sessions, logs, sets and the exercise catalog.
        AutoMigration(from = 4, to = 5),
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

    companion object {
        const val NAME = "trackbit.db"
    }
}
