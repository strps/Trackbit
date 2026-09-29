package com.trackbit.core.database.di

import android.content.Context
import androidx.room.Room
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.database.dao.DayLogDao
import com.trackbit.core.database.dao.HabitDao
import com.trackbit.core.database.dao.HabitDayDao
import com.trackbit.core.database.dao.OutboxDao
import com.trackbit.core.database.dao.SyncDao
import com.trackbit.core.database.dao.TimerDao
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {
    @Provides
    @Singleton
    fun database(@ApplicationContext context: Context): TrackbitDatabase =
        Room.databaseBuilder(context, TrackbitDatabase::class.java, TrackbitDatabase.NAME).build()

    @Provides fun habitDao(db: TrackbitDatabase): HabitDao = db.habitDao()
    @Provides fun dayLogDao(db: TrackbitDatabase): DayLogDao = db.dayLogDao()
    @Provides fun habitDayDao(db: TrackbitDatabase): HabitDayDao = db.habitDayDao()
    @Provides fun outboxDao(db: TrackbitDatabase): OutboxDao = db.outboxDao()
    @Provides fun syncDao(db: TrackbitDatabase): SyncDao = db.syncDao()
    @Provides fun timerDao(db: TrackbitDatabase): TimerDao = db.timerDao()
}
