package com.trackbit.core.database

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/** The migrations Room can't generate. [TrackbitDatabase] lists the automatic ones. */
object Migrations {
    /**
     * 4: history requests are keyed by owner. The one request a version 3 database can hold
     * belongs to the heatmap widgets, the only owner then.
     */
    val FROM_3_TO_4 = object : Migration(3, 4) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS `history_new` (`owner` TEXT NOT NULL, `start` TEXT NOT NULL, " +
                    "`syncedStart` TEXT, `syncedAt` INTEGER, PRIMARY KEY(`owner`))",
            )
            db.execSQL(
                "INSERT INTO `history_new` (`owner`, `start`, `syncedStart`, `syncedAt`) " +
                    "SELECT 'Heatmap', `start`, `syncedStart`, `syncedAt` FROM `history`",
            )
            db.execSQL("DROP TABLE `history`")
            db.execSQL("ALTER TABLE `history_new` RENAME TO `history`")
        }
    }

    val ALL = arrayOf(FROM_3_TO_4)
}
