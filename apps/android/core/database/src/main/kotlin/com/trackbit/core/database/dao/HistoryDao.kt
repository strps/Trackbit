package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import com.trackbit.core.database.entity.HistoryEntity
import com.trackbit.core.model.HistoryOwner
import java.time.LocalDate

/** History requests, one per owner; the logs they bring arrive through [SyncDao.applyDays]. */
@Dao
abstract class HistoryDao {
    @Query("SELECT * FROM history WHERE owner = :owner")
    abstract suspend fun get(owner: HistoryOwner): HistoryEntity?

    @Query("SELECT * FROM history")
    abstract suspend fun all(): List<HistoryEntity>

    @Upsert
    abstract suspend fun upsert(history: HistoryEntity)

    /**
     * Forgets [owner]'s request and drops the logs no request needs any more: those before both
     * [recentFrom] (the week `/today` keeps) and every remaining request's start. Days with ops
     * still in the outbox stay.
     */
    @Transaction
    open suspend fun release(owner: HistoryOwner, recentFrom: LocalDate) {
        delete(owner)
        val keepFrom = listOfNotNull(recentFrom, earliestStart()).min()
        deleteLogsBefore(keepFrom)
        // A remaining request may have been pulled from further back, with the released one.
        clampSyncedStart(keepFrom)
    }

    @Query("DELETE FROM history WHERE owner = :owner")
    protected abstract suspend fun delete(owner: HistoryOwner)

    @Query("SELECT MIN(start) FROM history")
    protected abstract suspend fun earliestStart(): LocalDate?

    @Query(
        """
        DELETE FROM day_logs WHERE localDay < :day AND NOT EXISTS (
            SELECT 1 FROM outbox WHERE outbox.habitId = day_logs.habitId AND outbox.localDay = day_logs.localDay
        )
        """,
    )
    protected abstract suspend fun deleteLogsBefore(day: LocalDate)

    @Query("UPDATE history SET syncedStart = :day WHERE syncedStart < :day")
    protected abstract suspend fun clampSyncedStart(day: LocalDate)
}
