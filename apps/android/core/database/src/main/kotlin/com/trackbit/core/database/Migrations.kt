package com.trackbit.core.database

import androidx.room.RoomDatabase
import androidx.room.migration.AutoMigrationSpec
import androidx.sqlite.db.SupportSQLiteDatabase

/** How a database from an older version opens. From version 9 on, every schema change needs a migration. */
object Migrations {
    /**
     * Versions before 9 named habits, exercises and lists by the server's int id, which the app can't
     * turn into uuids offline. They open empty (the outbox and running timers included) and refill
     * from the next sync. Fine only because no released build has them (F2, user's choice).
     */
    private val RESET_FROM = (1..8).toList().toIntArray()

    fun RoomDatabase.Builder<TrackbitDatabase>.withMigrations(): RoomDatabase.Builder<TrackbitDatabase> =
        fallbackToDestructiveMigrationFrom(dropAllTables = true, *RESET_FROM)

    /**
     * Exercises gained their info sheet fields, empty in every row this migration keeps. Marking
     * the catalog's pull as old makes the next sync refill them, instead of after up to an hour.
     */
    class From10To11 : AutoMigrationSpec {
        override fun onPostMigrate(db: SupportSQLiteDatabase) {
            db.execSQL("UPDATE config_pulls SET pulledAt = 0 WHERE part = 'Exercises'")
        }
    }
}
