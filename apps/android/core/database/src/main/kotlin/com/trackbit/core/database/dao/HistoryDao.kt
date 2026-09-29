package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import com.trackbit.core.database.entity.HistoryEntity
import java.time.LocalDate

/** The history request; the logs it brings arrive through [SyncDao.applyDays]. */
@Dao
abstract class HistoryDao {
    @Query("SELECT * FROM history WHERE id = ${HistoryEntity.ID}")
    abstract suspend fun get(): HistoryEntity?

    @Upsert
    abstract suspend fun upsert(history: HistoryEntity)

    /**
     * Stops keeping history: forgets the request and drops the logs before [keepFrom], except days
     * with ops still in the outbox.
     */
    @Transaction
    open suspend fun release(keepFrom: LocalDate) {
        delete()
        deleteLogsBefore(keepFrom)
    }

    @Query("DELETE FROM history")
    protected abstract suspend fun delete()

    @Query(
        """
        DELETE FROM day_logs WHERE localDay < :day AND NOT EXISTS (
            SELECT 1 FROM outbox WHERE outbox.habitId = day_logs.habitId AND outbox.localDay = day_logs.localDay
        )
        """,
    )
    protected abstract suspend fun deleteLogsBefore(day: LocalDate)
}
