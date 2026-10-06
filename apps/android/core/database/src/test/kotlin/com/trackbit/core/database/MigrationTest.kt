package com.trackbit.core.database

import androidx.room.Room
import androidx.room.testing.MigrationTestHelper
import androidx.test.core.app.ApplicationProvider
import androidx.test.platform.app.InstrumentationRegistry
import com.trackbit.core.database.Migrations.withMigrations
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.time.LocalDate

/** Opening older databases against the exported schemas. */
@RunWith(RobolectricTestRunner::class)
class MigrationTest {
    @get:Rule
    val helper = MigrationTestHelper(InstrumentationRegistry.getInstrumentation(), TrackbitDatabase::class.java)

    @Test fun `a version 8 database, named by int ids, opens empty`() = runTest {
        helper.createDatabase(NAME, 8).use { db ->
            db.execSQL(
                "INSERT INTO habits (id, name, description, type, isAntiHabit, icon, colorTheme, colorStops, dailyGoal, " +
                    "weeklyGoal, `order`, frozen, firstLogDay, streakBeforeDay, summaryDay) " +
                    "VALUES (1, 'Read', NULL, 'count', 0, 'book', 'green', '[]', 1, 5, 0, 0, NULL, 0, '2026-09-26')",
            )
            db.execSQL(
                "INSERT INTO outbox (type, habitId, localDay, payload, idempotencyKey, createdAt, attempts) " +
                    "VALUES ('Check', 1, '2026-09-26', '{}', 'key-1', 0, 0)",
            )
        }

        val db = Room.databaseBuilder(ApplicationProvider.getApplicationContext(), TrackbitDatabase::class.java, NAME)
            .withMigrations()
            .allowMainThreadQueries()
            .build()
        try {
            assertNull(db.outboxDao().oldest())
            assertEquals("the current version", 10, db.openHelper.readableDatabase.version)
            db.openHelper.readableDatabase.query("SELECT COUNT(*) FROM habits").use { cursor ->
                cursor.moveToFirst()
                assertEquals(0, cursor.getInt(0))
            }
        } finally {
            db.close()
        }
    }

    @Test fun `version 9 to 10 keeps habits, their logs and the outbox, and adds the config tables`() = runTest {
        helper.createDatabase(NAME, 9).use { db ->
            db.execSQL(
                "INSERT INTO habits (uuid, name, description, type, isAntiHabit, icon, colorTheme, colorStops, dailyGoal, " +
                    "weeklyGoal, `order`, frozen, firstLogDay, streakBeforeDay, summaryDay) " +
                    "VALUES ('h-1', 'Read', NULL, 'count', 0, 'book', 'green', '[]', 1, 5, 0, 0, '2026-09-20', 3, '2026-09-26')",
            )
            db.execSQL("INSERT INTO day_logs (habitUuid, localDay, rating, sessionCount) VALUES ('h-1', '2026-09-26', 2, 0)")
            db.execSQL(
                "INSERT INTO outbox (type, habitUuid, localDay, payload, idempotencyKey, createdAt, attempts) " +
                    "VALUES ('Check', 'h-1', '2026-09-26', '{}', 'key-1', 0, 0)",
            )
        }

        helper.runMigrationsAndValidate(NAME, 10, true).close()
        val db = Room.databaseBuilder(ApplicationProvider.getApplicationContext(), TrackbitDatabase::class.java, NAME)
            .withMigrations()
            .allowMainThreadQueries()
            .build()
        try {
            val habit = db.habitDao().get("h-1")!!
            assertEquals(LocalDate.of(2026, 9, 26), habit.summaryDay)
            assertEquals(3, habit.streakBeforeDay)
            assertEquals(emptyList<Any>(), habit.ownColorStops)
            assertEquals(2, db.dayLogDao().get("h-1", LocalDate.of(2026, 9, 26))?.rating)
            assertEquals("key-1", db.outboxDao().oldest()?.idempotencyKey)
            assertEquals(emptyMap<Any, Any>(), db.syncDao().configPulls())
        } finally {
            db.close()
        }
    }

    private companion object {
        const val NAME = "migration-test.db"
    }
}
