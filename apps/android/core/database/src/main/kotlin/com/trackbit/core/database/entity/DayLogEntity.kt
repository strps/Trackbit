package com.trackbit.core.database.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import com.trackbit.core.model.RecentDay
import java.time.LocalDate

/**
 * One habit's tracking on one day, keyed by ([habitId], [localDay]) like the server's
 * `UNIQUE(habit_id, local_day)`. It holds the server's value, or an optimistic one while
 * outbox ops for the same key are pending.
 */
@Entity(
    tableName = "day_logs",
    primaryKeys = ["habitId", "localDay"],
    foreignKeys = [
        ForeignKey(entity = HabitEntity::class, parentColumns = ["id"], childColumns = ["habitId"], onDelete = ForeignKey.CASCADE),
    ],
    indices = [Index("localDay")],
)
data class DayLogEntity(
    val habitId: Int,
    val localDay: LocalDate,
    /** A count, 1/0 for check habits, or milliseconds for timed habits. */
    val rating: Int?,
    /** Exercise sessions attached to the day (complex habits). */
    val sessionCount: Int = 0,
) {
    fun toRecentDay() = RecentDay(day = localDay, rating = rating, sessionCount = sessionCount)
}
