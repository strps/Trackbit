package com.trackbit.core.database.entity

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.Relation
import java.time.Instant
import java.time.LocalDate

// A day's exercise sessions, their logs (one exercise each) and the logs' sets. Rows are keyed by
// the uuid the app chose when it created them, which the server keeps, so a row is the same row
// before and after it reaches the server. Like day logs, a day's rows hold the server's values,
// or optimistic ones while outbox ops for that (habit, day) are pending.

@Entity(
    tableName = SessionEntity.TABLE,
    foreignKeys = [
        ForeignKey(entity = HabitEntity::class, parentColumns = ["id"], childColumns = ["habitId"], onDelete = ForeignKey.CASCADE),
    ],
    indices = [Index("habitId", "localDay")],
)
data class SessionEntity(
    @PrimaryKey val uuid: String,
    val habitId: Int,
    val localDay: LocalDate,
    val createdAt: Instant,
) {
    companion object {
        const val TABLE = "exercise_sessions"
    }
}

/** One exercise in a session. */
@Entity(
    tableName = ExerciseLogEntity.TABLE,
    foreignKeys = [
        ForeignKey(entity = SessionEntity::class, parentColumns = ["uuid"], childColumns = ["sessionUuid"], onDelete = ForeignKey.CASCADE),
    ],
    indices = [Index("sessionUuid")],
)
data class ExerciseLogEntity(
    @PrimaryKey val uuid: String,
    val sessionUuid: String,
    /** Not a foreign key: the catalog is replaced wholesale and may lag behind. */
    val exerciseId: Int,
    /** The list item it was picked from, or null for an ad-hoc pick. */
    val listItemId: Int?,
    val createdAt: Instant,
    val distance: Double?,
    /** Seconds. */
    val duration: Int?,
    val distanceUnit: String?,
    val weightUnit: String?,
) {
    companion object {
        const val TABLE = "exercise_logs"
    }
}

/** One set (a server `exercise_performances` row). */
@Entity(
    tableName = PerformanceEntity.TABLE,
    foreignKeys = [
        ForeignKey(entity = ExerciseLogEntity::class, parentColumns = ["uuid"], childColumns = ["logUuid"], onDelete = ForeignKey.CASCADE),
    ],
    indices = [Index("logUuid")],
)
data class PerformanceEntity(
    @PrimaryKey val uuid: String,
    val logUuid: String,
    /** Its place in the log, from 1. */
    val number: Int,
    val reps: Int?,
    val weight: Double?,
    /** Milliseconds. */
    val duration: Int?,
    val distance: Double?,
    val rpe: Int?,
    val createdAt: Instant,
) {
    companion object {
        const val TABLE = "exercise_performances"
    }
}

/** A session with its logs and their sets, as read in one transaction. Children are unordered. */
data class SessionWithLogs(
    @Embedded val session: SessionEntity,
    @Relation(entity = ExerciseLogEntity::class, parentColumn = "uuid", entityColumn = "sessionUuid")
    val logs: List<LogWithSets>,
)

data class LogWithSets(
    @Embedded val log: ExerciseLogEntity,
    @Relation(parentColumn = "uuid", entityColumn = "logUuid")
    val sets: List<PerformanceEntity>,
)
