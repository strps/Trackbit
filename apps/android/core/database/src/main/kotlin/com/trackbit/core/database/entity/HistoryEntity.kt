package com.trackbit.core.database.entity

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.trackbit.core.model.HistoryOwner
import java.time.Instant
import java.time.LocalDate

/**
 * One owner's request to keep day logs from [start] on, beyond the week `/today` brings. While
 * any request exists, logs from the earliest [start] on are pulled from `/api/tracker/days` now
 * and then. [syncedStart] and [syncedAt] describe the last pull that covered this request: logs
 * from [syncedStart] up to the pull's day are all in Room.
 */
@Entity(tableName = HistoryEntity.TABLE)
data class HistoryEntity(
    @PrimaryKey val owner: HistoryOwner,
    val start: LocalDate,
    val syncedStart: LocalDate? = null,
    val syncedAt: Instant? = null,
) {
    companion object {
        const val TABLE = "history"
    }
}
