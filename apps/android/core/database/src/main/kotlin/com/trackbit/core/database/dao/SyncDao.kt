package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert
import com.trackbit.core.database.entity.ConfigPart
import com.trackbit.core.database.entity.ConfigPullEntity
import com.trackbit.core.database.entity.DayLogEntity
import com.trackbit.core.database.entity.ExerciseEntity
import com.trackbit.core.database.entity.ExerciseListEntity
import com.trackbit.core.database.entity.ExerciseListItemEntity
import com.trackbit.core.database.entity.ExerciseLogEntity
import com.trackbit.core.database.entity.ExerciseSourceEntity
import com.trackbit.core.database.entity.HabitEntity
import com.trackbit.core.database.entity.HabitSetEntity
import com.trackbit.core.database.entity.HabitSetPullEntity
import com.trackbit.core.database.entity.LimitsEntity
import com.trackbit.core.database.entity.MuscleGroupEntity
import com.trackbit.core.database.entity.PerformanceEntity
import com.trackbit.core.database.entity.QueueEntryEntity
import com.trackbit.core.database.entity.SessionEntity
import com.trackbit.core.database.entity.SourceQueueEntity
import com.trackbit.core.database.entity.toEntity
import com.trackbit.core.model.DayLog
import com.trackbit.core.model.DaysResponse
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.ExerciseListItemsResponse
import com.trackbit.core.model.ExerciseSessionDetail
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.Habit
import com.trackbit.core.model.HabitOrder
import com.trackbit.core.model.HabitSetsResponse
import com.trackbit.core.model.LimitsResponse
import com.trackbit.core.model.MuscleGroup
import com.trackbit.core.model.ResolvedQueue
import com.trackbit.core.model.TodayResponse
import java.time.Instant
import java.time.LocalDate

/**
 * Writes server data into Room: `/today` snapshots, the rows tracker writes return, a day's
 * sessions, the exercise catalog, the picker's sources and queues, the analytics sets, and the
 * config (habits, lists, muscle groups, limits) as pulled or as a config write answered. The only
 * way server data reaches Room, so the pending-op guard lives in one place.
 */
@Dao
abstract class SyncDao {
    /**
     * Makes Room match a `/api/tracker/today` response: habits are replaced (deleted ones go,
     * with their logs), and each habit's `recent` days overwrite the local logs.
     *
     * A day log with ops still in the outbox keeps its optimistic value, and so does a pending
     * first log day, so a sync that lands before the outbox flushes never undoes a tap.
     */
    @Transaction
    open suspend fun applyToday(today: TodayResponse) {
        val pending = pendingDays().toSet()
        val pendingHabits = pending.mapTo(HashSet()) { it.habitUuid }
        val local = habits().associateBy { it.uuid }

        deleteHabitsNotIn(today.habits.map { it.uuid })
        upsertHabits(
            today.habits.map { habit ->
                val entity = habit.toEntity(today.day, local[habit.uuid])
                val localFirst = local[habit.uuid]?.firstLogDay
                if (habit.uuid in pendingHabits) entity.copy(firstLogDay = earliest(entity.firstLogDay, localFirst)) else entity
            },
        )
        for (habit in today.habits) {
            for (day in habit.recent) {
                if (HabitDayKey(habit.uuid, day.day) in pending) continue
                if (day.rating == null && day.sessionCount == 0) {
                    deleteLog(habit.uuid, day.day)
                } else {
                    upsertLog(DayLogEntity(habit.uuid, day.day, day.rating, day.sessionCount))
                }
            }
        }
    }

    /**
     * Outbox op [opId] reached the server, which answered with [log]. Removes the op and stores
     * the server's row, unless more ops for that day log are still pending: their optimistic
     * change is newer, and the last of them brings the final row.
     */
    @Transaction
    open suspend fun applyConfirmed(opId: Long, log: DayLog) {
        deleteOp(opId)
        if (hasPending(log.habitUuid, log.localDay) || !habitExists(log.habitUuid)) return
        // The row carries no session count; attaching sessions doesn't go through the outbox.
        val sessionCount = log(log.habitUuid, log.localDay)?.sessionCount ?: 0
        upsertLog(DayLogEntity(log.habitUuid, log.localDay, log.rating, sessionCount))
        extendFirstLogDay(log.habitUuid, log.localDay)
    }

    /**
     * Makes Room's logs from [DaysResponse.start] to [DaysResponse.end] match a
     * `/api/tracker/days` response made at [syncedAt]. Days with pending ops keep their optimistic
     * value, and days of habits Room doesn't have are skipped: the next `/today` brings the habit.
     *
     * The pull is recorded on every request that starts within it (none is created), which is
     * right only if Room is fresh from [DaysResponse.end] on: a pull longer than `/days` allows
     * comes in chunks, newest first, and [DaysResponse.end] is the device's day.
     */
    @Transaction
    open suspend fun applyDays(days: DaysResponse, syncedAt: Instant) {
        val pending = pendingDays().toSet()
        val habitUuids = habits().mapTo(HashSet()) { it.uuid }
        val server = days.days.associateBy { HabitDayKey(it.habitUuid, it.day) }
        for (local in logDaysBetween(days.start, days.end)) {
            if (local !in server && local !in pending) deleteLog(local.habitUuid, local.localDay)
        }
        for ((key, day) in server) {
            if (key in pending || day.habitUuid !in habitUuids) continue
            if (day.rating == null && day.sessionCount == 0) {
                deleteLog(day.habitUuid, day.day)
            } else {
                upsertLog(DayLogEntity(day.habitUuid, day.day, day.rating, day.sessionCount))
            }
        }
        recordHistorySync(days.start, syncedAt)
    }

    /**
     * Makes Room's sessions of [habitUuid] on [day] (with their logs and sets) match a
     * `GET /api/tracker/exercise-sessions` response, and the day log's session count with them.
     * Skipped while ops for that day are pending: their optimistic rows are newer, and session ops
     * share the day log's key.
     */
    @Transaction
    open suspend fun applySessions(habitUuid: String, day: LocalDate, sessions: List<ExerciseSessionDetail>) {
        if (hasPending(habitUuid, day) || !habitExists(habitUuid)) return
        // Children cascade. Rows keep their uuids, so a row on screen stays the same row.
        deleteSessions(habitUuid, day)
        for (session in sessions) {
            insertSession(SessionEntity(session.uuid, habitUuid, day, session.createdAt ?: Instant.EPOCH))
            for (log in session.exerciseLogs) {
                insertLog(
                    ExerciseLogEntity(
                        uuid = log.uuid,
                        sessionUuid = session.uuid,
                        exerciseUuid = log.exerciseUuid,
                        listItemUuid = log.listItemUuid,
                        createdAt = log.createdAt ?: Instant.EPOCH,
                        distance = log.distance,
                        duration = log.duration,
                        distanceUnit = log.distanceUnit,
                        weightUnit = log.weightUnit,
                    ),
                )
                for (set in log.exercisePerformances) {
                    insertSet(
                        PerformanceEntity(
                            uuid = set.uuid,
                            logUuid = log.uuid,
                            number = set.number,
                            reps = set.reps,
                            weight = set.weight,
                            duration = set.duration,
                            distance = set.distance,
                            rpe = set.rpe,
                            createdAt = set.createdAt ?: Instant.EPOCH,
                        ),
                    )
                }
            }
        }
        val log = log(habitUuid, day)
        if (log != null) {
            upsertLog(log.copy(sessionCount = sessions.size))
        } else if (sessions.isNotEmpty()) {
            // The server made the day's log when the first session started.
            upsertLog(DayLogEntity(habitUuid, day, rating = null, sessionCount = sessions.size))
            extendFirstLogDay(habitUuid, day)
        }
    }

    /** Replaces the exercise catalog, pulled at [pulledAt]. Nothing local is pending against it. */
    @Transaction
    open suspend fun applyExercises(exercises: List<Exercise>, pulledAt: Instant) {
        deleteExercisesNotIn(exercises.map { it.uuid })
        upsertExercises(exercises.map { it.toEntity() })
        recordPull(ConfigPullEntity(ConfigPart.Exercises, pulledAt))
    }

    /** A custom exercise write answered with [exercise]: Room's row becomes the server's. */
    open suspend fun storeExercise(exercise: Exercise) = upsertExercises(listOf(exercise.toEntity()))

    // Config -------------------------------------------------------------------------------------

    /**
     * Makes Room's habits match a `GET /api/habits` response pulled at [pulledAt]: deleted ones go
     * (with their logs), and each habit's config columns are replaced. The tracker's summary and
     * a pending first log day stay as `/today` and the outbox left them.
     */
    @Transaction
    open suspend fun applyHabits(habits: List<Habit>, pulledAt: Instant) {
        val local = habits().associateBy { it.uuid }
        deleteHabitsNotIn(habits.map { it.uuid })
        upsertHabits(habits.map { it.toEntity(local[it.uuid]) })
        recordPull(ConfigPullEntity(ConfigPart.Habits, pulledAt))
    }

    /**
     * A habit write answered with [habit]: its config columns become the server's. A new habit
     * stays unsummarized until the next `/today`.
     */
    @Transaction
    open suspend fun storeHabit(habit: Habit) {
        upsertHabits(listOf(habit.toEntity(habit(habit.uuid))))
    }

    /** The habit was deleted on the server, with its logs and sessions. */
    @Query("DELETE FROM habits WHERE uuid = :uuid")
    abstract suspend fun removeHabit(uuid: String)

    /** A reorder went through: each habit takes its group and place from [order]. */
    @Transaction
    open suspend fun storeHabitOrder(order: List<HabitOrder>) {
        for (habit in order) setHabitOrder(habit.uuid, habit.order, habit.isAntiHabit)
    }

    /** Replaces Room's lists and their items with [lists], pulled (or answered by a reorder) at [pulledAt]. */
    @Transaction
    open suspend fun applyLists(lists: List<ExerciseList>, pulledAt: Instant) {
        // Items cascade.
        deleteAllLists()
        for (list in lists) insertListWithItems(list)
        recordPull(ConfigPullEntity(ConfigPart.Lists, pulledAt))
    }

    /** A list write answered with [list]: Room's copy, items included, becomes the server's. */
    @Transaction
    open suspend fun storeList(list: ExerciseList) {
        upsertList(list.toEntity())
        deleteItemsOf(list.uuid)
        insertItems(list.items.map { it.toEntity(list.uuid) })
    }

    /** An items write answered with [items]: the list's items become the server's. */
    @Transaction
    open suspend fun storeListItems(items: ExerciseListItemsResponse) {
        if (!listExists(items.listUuid)) return
        deleteItemsOf(items.listUuid)
        insertItems(items.items.map { it.toEntity(items.listUuid) })
    }

    /** The list was deleted on the server; its items go with it. */
    @Query("DELETE FROM exercise_lists WHERE uuid = :uuid")
    abstract suspend fun removeList(uuid: String)

    /** Replaces the muscle group taxonomy with [groups], pulled at [pulledAt]. */
    @Transaction
    open suspend fun applyMuscleGroups(groups: List<MuscleGroup>, pulledAt: Instant) {
        deleteAllMuscleGroups()
        insertMuscleGroups(groups.map { it.toEntity() })
        recordPull(ConfigPullEntity(ConfigPart.MuscleGroups, pulledAt))
    }

    /** Stores the role's caps from [limits], pulled at [pulledAt]. */
    @Transaction
    open suspend fun applyLimits(limits: LimitsResponse, pulledAt: Instant) {
        upsertLimits(LimitsEntity(effective = limits.effective))
        recordPull(ConfigPullEntity(ConfigPart.Limits, pulledAt))
    }

    /** When each config part was last pulled; a part never pulled has no entry. */
    suspend fun configPulls(): Map<ConfigPart, Instant> = pulls().associate { it.part to it.pulledAt }

    private suspend fun insertListWithItems(list: ExerciseList) {
        insertList(list.toEntity())
        insertItems(list.items.map { it.toEntity(list.uuid) })
    }

    @Query("SELECT * FROM config_pulls")
    protected abstract suspend fun pulls(): List<ConfigPullEntity>

    @Upsert protected abstract suspend fun recordPull(pull: ConfigPullEntity)

    @Query("UPDATE habits SET `order` = :order, isAntiHabit = :isAntiHabit WHERE uuid = :uuid")
    protected abstract suspend fun setHabitOrder(uuid: String, order: Int, isAntiHabit: Boolean)

    @Query("SELECT * FROM habits WHERE uuid = :uuid")
    protected abstract suspend fun habit(uuid: String): HabitEntity?

    @Query("DELETE FROM exercise_lists")
    protected abstract suspend fun deleteAllLists()

    @Query("SELECT EXISTS(SELECT 1 FROM exercise_lists WHERE uuid = :uuid)")
    protected abstract suspend fun listExists(uuid: String): Boolean

    @Insert protected abstract suspend fun insertList(list: ExerciseListEntity)
    @Upsert protected abstract suspend fun upsertList(list: ExerciseListEntity)

    @Query("DELETE FROM exercise_list_items WHERE listUuid = :listUuid")
    protected abstract suspend fun deleteItemsOf(listUuid: String)

    @Insert protected abstract suspend fun insertItems(items: List<ExerciseListItemEntity>)

    @Query("DELETE FROM muscle_groups")
    protected abstract suspend fun deleteAllMuscleGroups()

    @Insert protected abstract suspend fun insertMuscleGroups(groups: List<MuscleGroupEntity>)
    @Upsert protected abstract suspend fun upsertLimits(limits: LimitsEntity)

    /**
     * The user deleted their exercise [uuid] on the server, which took every log of it (and their
     * sets) and its list items along: drops Room's copies so cached sessions, analytics, lists and
     * queues stop showing it before their next pull.
     */
    @Transaction
    open suspend fun removeExercise(uuid: String) {
        deleteLogsOf(uuid)
        deleteHabitSetsOf(uuid)
        deleteQueueEntriesOf(uuid)
        deleteListItemsOf(uuid)
        deleteExercise(uuid)
    }

    /** Replaces the exercise sources. A source no longer listed takes its cached queue with it. */
    @Transaction
    open suspend fun applySources(sources: List<ExerciseSourceDescriptor>) {
        deleteAllSources()
        insertSources(sources.mapIndexed { i, source -> source.toEntity(i) })
        deleteQueuesNotIn(sources.map { it.key })
    }

    /** Replaces [key]'s queue with the server's answer: [queue], or null when it no longer resolves. */
    @Transaction
    open suspend fun applyQueue(key: String, queue: ResolvedQueue?, pulledAt: Instant) {
        // Replacing the row cascades to its old entries.
        deleteQueue(key)
        insertQueue(SourceQueueEntity(key, gone = queue == null, emptyReason = queue?.emptyReason, pulledAt = pulledAt))
        if (queue != null) {
            insertEntries(
                queue.entries.mapIndexed { i, e -> QueueEntryEntity(key, i, e.exerciseUuid, e.position, e.listItemUuid, e.prescription) },
            )
        }
    }

    /** Replaces Room's sets of [HabitSetsResponse.habitUuid] with [sets], pulled at [pulledAt]. */
    @Transaction
    open suspend fun applySets(sets: HabitSetsResponse, pulledAt: Instant) {
        if (!habitExists(sets.habitUuid)) return
        deleteSets(sets.habitUuid)
        insertSets(
            sets.sets.mapIndexed { i, s ->
                HabitSetEntity(sets.habitUuid, i, s.day, s.exerciseUuid, s.weight, s.reps, s.rpe, s.duration, s.distance)
            },
        )
        upsertSetPull(HabitSetPullEntity(sets.habitUuid, pulledAt))
    }

    @Query("DELETE FROM habit_sets WHERE habitUuid = :habitUuid")
    protected abstract suspend fun deleteSets(habitUuid: String)

    @Insert protected abstract suspend fun insertSets(sets: List<HabitSetEntity>)
    @Upsert protected abstract suspend fun upsertSetPull(pull: HabitSetPullEntity)

    @Query("DELETE FROM exercise_sources")
    protected abstract suspend fun deleteAllSources()

    @Insert protected abstract suspend fun insertSources(sources: List<ExerciseSourceEntity>)

    /** The sources whose queue Room holds (a pull refreshes them after a list changed). */
    @Query("SELECT `key` FROM source_queues")
    abstract suspend fun cachedQueueKeys(): List<String>

    @Query("DELETE FROM source_queues WHERE `key` NOT IN (:keys)")
    protected abstract suspend fun deleteQueuesNotIn(keys: List<String>)

    @Query("DELETE FROM source_queues WHERE `key` = :key")
    protected abstract suspend fun deleteQueue(key: String)

    @Insert protected abstract suspend fun insertQueue(queue: SourceQueueEntity)
    @Insert protected abstract suspend fun insertEntries(entries: List<QueueEntryEntity>)

    @Query("DELETE FROM exercise_sessions WHERE habitUuid = :habitUuid AND localDay = :day")
    protected abstract suspend fun deleteSessions(habitUuid: String, day: LocalDate)

    @Insert protected abstract suspend fun insertSession(session: SessionEntity)
    @Insert protected abstract suspend fun insertLog(log: ExerciseLogEntity)
    @Insert protected abstract suspend fun insertSet(set: PerformanceEntity)

    @Query("DELETE FROM exercise_logs WHERE exerciseUuid = :uuid")
    protected abstract suspend fun deleteLogsOf(uuid: String)

    @Query("DELETE FROM habit_sets WHERE exerciseUuid = :uuid")
    protected abstract suspend fun deleteHabitSetsOf(uuid: String)

    @Query("DELETE FROM queue_entries WHERE exerciseUuid = :uuid")
    protected abstract suspend fun deleteQueueEntriesOf(uuid: String)

    @Query("DELETE FROM exercise_list_items WHERE exerciseUuid = :uuid")
    protected abstract suspend fun deleteListItemsOf(uuid: String)

    @Query("DELETE FROM exercises WHERE uuid = :uuid")
    protected abstract suspend fun deleteExercise(uuid: String)

    @Query("DELETE FROM exercises WHERE uuid NOT IN (:uuids)")
    protected abstract suspend fun deleteExercisesNotIn(uuids: List<String>)

    @Upsert
    protected abstract suspend fun upsertExercises(exercises: List<ExerciseEntity>)

    @Query("SELECT DISTINCT habitUuid, localDay FROM outbox")
    protected abstract suspend fun pendingDays(): List<HabitDayKey>

    @Query("SELECT habitUuid, localDay FROM day_logs WHERE localDay BETWEEN :start AND :end")
    protected abstract suspend fun logDaysBetween(start: LocalDate, end: LocalDate): List<HabitDayKey>

    @Query("UPDATE history SET syncedStart = :start, syncedAt = :at WHERE start >= :start")
    protected abstract suspend fun recordHistorySync(start: LocalDate, at: Instant)

    @Query("DELETE FROM outbox WHERE id = :id")
    protected abstract suspend fun deleteOp(id: Long)

    @Query("SELECT EXISTS(SELECT 1 FROM outbox WHERE habitUuid = :habitUuid AND localDay = :day)")
    protected abstract suspend fun hasPending(habitUuid: String, day: LocalDate): Boolean

    @Query("SELECT EXISTS(SELECT 1 FROM habits WHERE uuid = :uuid)")
    protected abstract suspend fun habitExists(uuid: String): Boolean

    @Query("SELECT * FROM day_logs WHERE habitUuid = :habitUuid AND localDay = :day")
    protected abstract suspend fun log(habitUuid: String, day: LocalDate): DayLogEntity?

    @Query("UPDATE habits SET firstLogDay = :day WHERE uuid = :uuid AND (firstLogDay IS NULL OR firstLogDay > :day)")
    protected abstract suspend fun extendFirstLogDay(uuid: String, day: LocalDate)

    @Query("SELECT * FROM habits")
    protected abstract suspend fun habits(): List<HabitEntity>

    @Query("DELETE FROM habits WHERE uuid NOT IN (:uuids)")
    protected abstract suspend fun deleteHabitsNotIn(uuids: List<String>)

    @Upsert
    protected abstract suspend fun upsertHabits(habits: List<HabitEntity>)

    @Upsert
    protected abstract suspend fun upsertLog(log: DayLogEntity)

    @Query("DELETE FROM day_logs WHERE habitUuid = :habitUuid AND localDay = :day")
    protected abstract suspend fun deleteLog(habitUuid: String, day: LocalDate)

    private fun earliest(a: LocalDate?, b: LocalDate?): LocalDate? = listOfNotNull(a, b).minOrNull()
}
