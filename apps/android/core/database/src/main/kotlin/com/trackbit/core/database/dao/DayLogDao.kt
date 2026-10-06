package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import com.trackbit.core.database.entity.DayLogEntity
import java.time.LocalDate

/** Optimistic day-log writes, mirroring the server's tracker upserts. */
@Dao
abstract class DayLogDao {
    @Query("SELECT * FROM day_logs WHERE habitUuid = :habitUuid AND localDay = :day")
    abstract suspend fun get(habitUuid: String, day: LocalDate): DayLogEntity?

    @Upsert
    abstract suspend fun upsert(log: DayLogEntity)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    protected abstract suspend fun insertIfMissing(log: DayLogEntity)

    /** Like `POST /check`: the day's rating becomes [rating]. */
    @Transaction
    open suspend fun setRating(habitUuid: String, day: LocalDate, rating: Int): DayLogEntity {
        val log = (get(habitUuid, day) ?: DayLogEntity(habitUuid, day, rating = null)).copy(rating = rating)
        upsert(log)
        return log
    }

    /** Like `POST /check/increment`: adds [delta] to the day's rating, treating none as 0. */
    @Transaction
    open suspend fun addToRating(habitUuid: String, day: LocalDate, delta: Int): DayLogEntity {
        val current = get(habitUuid, day)
        val log = (current ?: DayLogEntity(habitUuid, day, rating = null)).copy(rating = (current?.rating ?: 0) + delta)
        upsert(log)
        return log
    }

    /** Like `POST /day-logs/ensure`: makes sure the day has a row, leaving an existing one as is. */
    @Transaction
    open suspend fun ensure(habitUuid: String, day: LocalDate): DayLogEntity {
        insertIfMissing(DayLogEntity(habitUuid, day, rating = null))
        return checkNotNull(get(habitUuid, day))
    }

    /** Starting (+1) or deleting (−1) one of the day's exercise sessions. */
    @Transaction
    open suspend fun addSessions(habitUuid: String, day: LocalDate, delta: Int): DayLogEntity {
        val current = get(habitUuid, day)
        val log = (current ?: DayLogEntity(habitUuid, day, rating = null))
            .let { it.copy(sessionCount = (it.sessionCount + delta).coerceAtLeast(0)) }
        upsert(log)
        return log
    }
}
