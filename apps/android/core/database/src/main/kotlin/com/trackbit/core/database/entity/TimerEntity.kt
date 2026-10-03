package com.trackbit.core.database.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.time.Instant
import java.time.LocalDate

/**
 * A running timer. Only the instants it started (and, counting down, ends) are stored, never a
 * ticking count, so it survives process death and reboots; stopping it deletes the row.
 *
 * Two kinds share the table and the notification:
 * - A habit timer counts up. It names its habit and the day its time is logged to, there is at
 *   most one per habit, and [endsAt] is null.
 * - The rest timer counts down between sets. It has no habit or day, only [endsAt], and there is
 *   at most one ([com.trackbit.core.database.dao.TimerDao.replaceRest]).
 */
@Entity(
    tableName = TimerEntity.TABLE,
    foreignKeys = [
        ForeignKey(entity = HabitEntity::class, parentColumns = ["id"], childColumns = ["habitId"], onDelete = ForeignKey.CASCADE),
    ],
    indices = [Index("habitId", unique = true)],
)
data class TimerEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val habitId: Int?,
    /** The day the elapsed time is logged to: the day shown when the timer started. */
    val localDay: LocalDate?,
    val startedAt: Instant,
    /** When a countdown (the rest timer) ends; null for a habit timer. */
    val endsAt: Instant? = null,
) {
    companion object {
        const val TABLE = "timers"
    }
}
