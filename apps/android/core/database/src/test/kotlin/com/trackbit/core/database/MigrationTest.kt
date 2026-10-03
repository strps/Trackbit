package com.trackbit.core.database

import androidx.room.testing.MigrationTestHelper
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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

    @Test fun `4 to 5 adds sessions and the exercise catalog, keeping pending writes`() {
        helper.createDatabase(NAME, 4).use { db ->
            db.execSQL(
                "INSERT INTO outbox (type, habitId, localDay, payload, idempotencyKey, createdAt, attempts) " +
                    "VALUES ('Check', 1, '2026-09-26', '{}', 'key-1', 0, 0)",
            )
        }

        helper.runMigrationsAndValidate(NAME, 5, true, *Migrations.ALL).use { db ->
            for (table in listOf("exercise_sessions", "exercise_logs", "exercise_performances", "exercises")) {
                db.query("SELECT COUNT(*) FROM $table").use { cursor ->
                    cursor.moveToFirst()
                    assertEquals(0, cursor.getInt(0))
                }
            }
            db.query("SELECT COUNT(*) FROM outbox").use { cursor ->
                cursor.moveToFirst()
                assertEquals(1, cursor.getInt(0))
            }
        }
    }

    @Test fun `5 to 6 adds exercise sources and their queues, keeping pending writes`() {
        helper.createDatabase(NAME, 5).use { db ->
            db.execSQL(
                "INSERT INTO outbox (type, habitId, localDay, payload, idempotencyKey, createdAt, attempts) " +
                    "VALUES ('Check', 1, '2026-09-26', '{}', 'key-1', 0, 0)",
            )
        }

        helper.runMigrationsAndValidate(NAME, 6, true, *Migrations.ALL).use { db ->
            for (table in listOf("exercise_sources", "source_queues", "queue_entries")) {
                db.query("SELECT COUNT(*) FROM $table").use { cursor ->
                    cursor.moveToFirst()
                    assertEquals(0, cursor.getInt(0))
                }
            }
            db.query("SELECT COUNT(*) FROM outbox").use { cursor ->
                cursor.moveToFirst()
                assertEquals(1, cursor.getInt(0))
            }
        }
    }

    @Test fun `6 to 7 adds timers' endsAt, keeping running timers`() {
        helper.createDatabase(NAME, 6).use { db ->
            db.execSQL("INSERT INTO timers (habitId, localDay, startedAt) VALUES (NULL, '2026-10-02', 1000)")
        }

        helper.runMigrationsAndValidate(NAME, 7, true, *Migrations.ALL).use { db ->
            db.query("SELECT localDay, startedAt, endsAt FROM timers").use { cursor ->
                cursor.moveToFirst()
                assertEquals("2026-10-02", cursor.getString(0))
                assertEquals(1000, cursor.getLong(1))
                assertTrue(cursor.isNull(2))
            }
        }
    }

    private companion object {
        const val NAME = "migration-test.db"
    }
}
