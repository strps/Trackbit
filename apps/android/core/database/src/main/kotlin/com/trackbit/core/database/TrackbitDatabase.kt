package com.trackbit.core.database

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.trackbit.core.database.dao.DayLogDao
import com.trackbit.core.database.dao.HabitDao
import com.trackbit.core.database.dao.HabitDayDao
import com.trackbit.core.database.dao.OutboxDao
import com.trackbit.core.database.dao.SyncDao
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.database.entity.OutboxEntity

/**
 * The local cache the UI and widgets read, plus the outbox of unsent tracker writes.
 * Schema changes need a migration: dropping the database would lose the outbox.
 */
@Database(
    entities = [HabitEntity::class, DayLogEntity::class, OutboxEntity::class],
    version = 1,
    exportSchema = true,
)
@TypeConverters(Converters::class)
abstract class TrackbitDatabase : RoomDatabase() {
    abstract fun habitDao(): HabitDao
    abstract fun dayLogDao(): DayLogDao
    abstract fun habitDayDao(): HabitDayDao
    abstract fun outboxDao(): OutboxDao
    abstract fun syncDao(): SyncDao

    companion object {
        const val NAME = "trackbit.db"
    }
}
