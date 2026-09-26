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
    @Query("SELECT * FROM day_logs WHERE habitId = :habitId AND localDay = :day")
    abstract suspend fun get(habitId: Int, day: LocalDate): DayLogEntity?

    @Upsert
    abstract suspend fun upsert(log: DayLogEntity)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    protected abstract suspend fun insertIfMissing(log: DayLogEntity)

    /** Like `POST /check`: the day's rating becomes [rating]. */
    @Transaction
    open suspend fun setRating(habitId: Int, day: LocalDate, rating: Int): DayLogEntity {
        val log = (get(habitId, day) ?: DayLogEntity(habitId, day, rating = null)).copy(rating = rating)
        upsert(log)
        return log
    }

    /** Like `POST /check/increment`: adds [delta] to the day's rating, treating none as 0. */
    @Transaction
    open suspend fun addToRating(habitId: Int, day: LocalDate, delta: Int): DayLogEntity {
        val current = get(habitId, day)
        val log = (current ?: DayLogEntity(habitId, day, rating = null)).copy(rating = (current?.rating ?: 0) + delta)
        upsert(log)
        return log
    }

    /** Like `POST /day-logs/ensure`: makes sure the day has a row, leaving an existing one as is. */
    @Transaction
    open suspend fun ensure(habitId: Int, day: LocalDate): DayLogEntity {
        insertIfMissing(DayLogEntity(habitId, day, rating = null))
        return checkNotNull(get(habitId, day))
    }
}
