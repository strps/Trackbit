package com.trackbit.core.data

import com.trackbit.core.data.sync.TrackerSync
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.model.HabitSet
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import javax.inject.Inject

/**
 * The sets the analytics charts aggregate. Like the other repositories, reads come from Room only;
 * the server's copy replaces Room's on [refresh]. Day values and history come from
 * [TrackerRepository], exercise names and muscle groups from [SessionRepository.observeExercises].
 */
interface AnalyticsRepository {
    /** Workout habit [habitId]'s sets as of the last [refresh], oldest day first; null if never pulled. */
    fun observeSets(habitId: Int): Flow<List<HabitSet>?>

    /** Reloads [habitId]'s sets and the exercise catalog. */
    suspend fun refresh(habitId: Int): SyncResult
}

internal class DefaultAnalyticsRepository @Inject constructor(
    db: TrackbitDatabase,
    private val sync: TrackerSync,
) : AnalyticsRepository {
    private val dao = db.habitSetDao()

    override fun observeSets(habitId: Int): Flow<List<HabitSet>?> =
        combine(dao.observePull(habitId), dao.observeSets(habitId)) { pull, sets ->
            if (pull == null) null else sets.map { it.toModel() }
        }

    override suspend fun refresh(habitId: Int): SyncResult = sync.syncSets(habitId)
}
