package com.trackbit.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.Instant
import java.time.LocalDate

/**
 * How far back Room keeps day logs, beyond the week `/today` brings. One row, present only while
 * something (a heatmap widget) asks for history: logs from [start] on are then pulled from
 * `/api/tracker/days` now and then. [syncedStart] and [syncedAt] describe the last pull.
 */
@Entity(tableName = HistoryEntity.TABLE)
data class HistoryEntity(
    @PrimaryKey val id: Int = ID,
    val start: LocalDate,
    val syncedStart: LocalDate? = null,
    val syncedAt: Instant? = null,
) {
    companion object {
        const val TABLE = "history"
        const val ID = 0
    }
}
