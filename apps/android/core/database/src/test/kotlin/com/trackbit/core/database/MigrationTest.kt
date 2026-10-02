package com.trackbit.core.database

import androidx.room.testing.MigrationTestHelper
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

/** Each migration against the exported schemas: an upgrade must keep the outbox. */
@RunWith(RobolectricTestRunner::class)
class MigrationTest {
    @get:Rule
    val helper = MigrationTestHelper(InstrumentationRegistry.getInstrumentation(), TrackbitDatabase::class.java)

    @Test fun `1 to 2 adds timers and keeps pending writes`() {
        helper.createDatabase(NAME, 1).use { db ->
            db.execSQL(
                "INSERT INTO outbox (type, habitId, localDay, payload, idempotencyKey, createdAt, attempts) " +
                    "VALUES ('Check', 1, '2026-09-26', '{}', 'key-1', 0, 0)",
            )
        }

        helper.runMigrationsAndValidate(NAME, 2, true).use { db ->
            db.query("SELECT idempotencyKey FROM outbox").use { cursor ->
                cursor.moveToFirst()
                assertEquals("key-1", cursor.getString(0))
            }
        }
    }

    @Test fun `2 to 3 adds history and keeps pending writes`() {
        helper.createDatabase(NAME, 2).use { db ->
            db.execSQL(
                "INSERT INTO outbox (type, habitId, localDay, payload, idempotencyKey, createdAt, attempts) " +
                    "VALUES ('Check', 1, '2026-09-26', '{}', 'key-1', 0, 0)",
            )
        }

        helper.runMigrationsAndValidate(NAME, 3, true).use { db ->
            db.query("SELECT idempotencyKey FROM outbox").use { cursor ->
                cursor.moveToFirst()
                assertEquals("key-1", cursor.getString(0))
            }
            db.query("SELECT COUNT(*) FROM history").use { cursor ->
                cursor.moveToFirst()
                assertEquals(0, cursor.getInt(0))
            }
        }
    }

    @Test fun `3 to 4 keys history by owner, keeping the heatmap's request`() {
        helper.createDatabase(NAME, 3).use { db ->
            db.execSQL("INSERT INTO history (id, start, syncedStart, syncedAt) VALUES (0, '2026-04-01', '2026-04-01', 5)")
            db.execSQL(
                "INSERT INTO outbox (type, habitId, localDay, payload, idempotencyKey, createdAt, attempts) " +
                    "VALUES ('Check', 1, '2026-09-26', '{}', 'key-1', 0, 0)",
            )
        }

        helper.runMigrationsAndValidate(NAME, 4, true, *Migrations.ALL).use { db ->
            db.query("SELECT owner, start, syncedStart, syncedAt FROM history").use { cursor ->
                cursor.moveToFirst()
                assertEquals("Heatmap", cursor.getString(0))
                assertEquals("2026-04-01", cursor.getString(1))
                assertEquals("2026-04-01", cursor.getString(2))
                assertEquals(5, cursor.getLong(3))
            }
            db.query("SELECT COUNT(*) FROM outbox").use { cursor ->
                cursor.moveToFirst()
                assertEquals(1, cursor.getInt(0))
            }
        }
    }

    private companion object {
        const val NAME = "migration-test.db"
    }
}
