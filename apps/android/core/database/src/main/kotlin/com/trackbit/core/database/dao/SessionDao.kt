package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction
import com.trackbit.core.database.entity.DatedLog
import com.trackbit.core.database.entity.ExerciseLogEntity
import com.trackbit.core.database.entity.PerformanceEntity
import com.trackbit.core.database.entity.SessionEntity
import com.trackbit.core.database.entity.SessionWithLogs
import kotlinx.coroutines.flow.Flow
import java.time.LocalDate

/** Reads of a day's sessions and the optimistic session writes, mirroring the server's routes. */
@Dao
abstract class SessionDao {
    /** [habitUuid]'s sessions on [day] with their logs and sets, unordered. */
    @Transaction
    @Query("SELECT * FROM exercise_sessions WHERE habitUuid = :habitUuid AND localDay = :day")
    abstract fun observeDay(habitUuid: String, day: LocalDate): Flow<List<SessionWithLogs>>

    // The day log each row belongs to: what its outbox ops are keyed by.

    @Query("SELECT habitUuid, localDay FROM exercise_sessions WHERE uuid = :uuid")
    abstract suspend fun sessionDay(uuid: String): HabitDayKey?

    @Query(
        "SELECT s.habitUuid, s.localDay FROM exercise_logs l JOIN exercise_sessions s ON s.uuid = l.sessionUuid " +
            "WHERE l.uuid = :uuid",
    )
    abstract suspend fun logDay(uuid: String): HabitDayKey?

    @Query(
        "SELECT s.habitUuid, s.localDay FROM exercise_performances p JOIN exercise_logs l ON l.uuid = p.logUuid " +
            "JOIN exercise_sessions s ON s.uuid = l.sessionUuid WHERE p.uuid = :uuid",
    )
    abstract suspend fun setDay(uuid: String): HabitDayKey?

    @Query("SELECT exerciseUuid FROM exercise_logs WHERE uuid = :uuid")
    abstract suspend fun exerciseOfLog(uuid: String): String?

    @Query("SELECT listItemUuid FROM exercise_logs WHERE uuid = :uuid")
    abstract suspend fun listItemOfLog(uuid: String): String?

    @Query(
        "SELECT l.exerciseUuid FROM exercise_performances p JOIN exercise_logs l ON l.uuid = p.logUuid WHERE p.uuid = :uuid",
    )
    abstract suspend fun exerciseOfSet(uuid: String): String?

    /** The newest set of [exerciseUuid] in Room, from any session. */
    @Query(
        "SELECT p.* FROM exercise_performances p JOIN exercise_logs l ON l.uuid = p.logUuid " +
            "WHERE l.exerciseUuid = :exerciseUuid ORDER BY p.createdAt DESC, p.number DESC LIMIT 1",
    )
    abstract suspend fun latestSet(exerciseUuid: String): PerformanceEntity?

    /**
     * The newest log of [exerciseUuid] in Room that has sets, other than [exceptLogUuid], with its
     * day: the info sheet's "last time" when it was logged offline, or after the server's latest.
     */
    @Transaction
    @Query(
        "SELECT l.*, s.localDay FROM exercise_logs l JOIN exercise_sessions s ON s.uuid = l.sessionUuid " +
            "WHERE l.exerciseUuid = :exerciseUuid AND (:exceptLogUuid IS NULL OR l.uuid != :exceptLogUuid) " +
            "AND EXISTS (SELECT 1 FROM exercise_performances p WHERE p.logUuid = l.uuid) " +
            "ORDER BY s.localDay DESC, l.createdAt DESC LIMIT 1",
    )
    abstract fun observeLatestLog(exerciseUuid: String, exceptLogUuid: String?): Flow<DatedLog?>

    @Query("SELECT COUNT(*) FROM exercise_performances WHERE logUuid = :logUuid")
    abstract suspend fun setCount(logUuid: String): Int

    @Insert abstract suspend fun insert(session: SessionEntity)
    @Insert abstract suspend fun insert(log: ExerciseLogEntity)
    @Insert abstract suspend fun insert(set: PerformanceEntity)

    /** Its logs and their sets go with it. */
    @Query("DELETE FROM exercise_sessions WHERE uuid = :uuid")
    abstract suspend fun deleteSession(uuid: String): Int

    /** Its sets go with it. */
    @Query("DELETE FROM exercise_logs WHERE uuid = :uuid")
    abstract suspend fun deleteLog(uuid: String): Int

    @Query("DELETE FROM exercise_performances WHERE uuid = :uuid")
    abstract suspend fun deleteSet(uuid: String): Int

    @Query(
        "UPDATE exercise_performances SET reps = :reps, weight = :weight, duration = :duration, " +
            "distance = :distance, rpe = :rpe WHERE uuid = :uuid",
    )
    abstract suspend fun updateSet(uuid: String, reps: Int?, weight: Double?, duration: Int?, distance: Double?, rpe: Int?): Int
}
