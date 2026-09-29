package com.trackbit.core.database.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import java.time.Instant
import java.time.LocalDate

/**
 * A running timer. Only the instant it started is stored, never a ticking count, so it survives
 * process death and reboots; stopping it deletes the row.
 *
 * A habit timer names its habit and the day its time is logged to, and there is at most one per
 * habit. The owner columns are nullable so timers that don't belong to a habit (the rest timer)
 * can share the table and the notification.
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
) {
    companion object {
        const val TABLE = "timers"
    }
}
