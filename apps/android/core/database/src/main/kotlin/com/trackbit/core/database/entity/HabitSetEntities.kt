package com.trackbit.core.database.entity

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.PrimaryKey
import com.trackbit.core.model.HabitSet
import java.time.Instant
import java.time.LocalDate

// A workout habit's sets as of its last `GET /api/tracker/sets`, for the analytics charts. Server
// data only: sets still in the outbox aren't here, as on the web. Kept until the habit goes.

/** One set, at [ordinal] in the server's order (oldest day first). */
@Entity(
    tableName = HabitSetEntity.TABLE,
    primaryKeys = ["habitId", "ordinal"],
    foreignKeys = [
        ForeignKey(entity = HabitEntity::class, parentColumns = ["id"], childColumns = ["habitId"], onDelete = ForeignKey.CASCADE),
    ],
)
data class HabitSetEntity(
    val habitId: Int,
    val ordinal: Int,
    val day: LocalDate,
    val exerciseId: Int,
    /** Kilograms. */
    val weight: Double?,
    val reps: Int?,
    val rpe: Int?,
    /** Milliseconds. */
    val duration: Int?,
    val distance: Double?,
) {
    fun toModel() = HabitSet(day, exerciseId, weight, reps, rpe, duration, distance)

    companion object {
        const val TABLE = "habit_sets"
    }
}

/** When [habitId]'s sets were last pulled. No row: never, so an empty list means "not known yet". */
@Entity(
    tableName = HabitSetPullEntity.TABLE,
    foreignKeys = [
        ForeignKey(entity = HabitEntity::class, parentColumns = ["id"], childColumns = ["habitId"], onDelete = ForeignKey.CASCADE),
    ],
)
data class HabitSetPullEntity(
    @PrimaryKey val habitId: Int,
    val pulledAt: Instant,
) {
    companion object {
        const val TABLE = "habit_set_pulls"
    }
}
