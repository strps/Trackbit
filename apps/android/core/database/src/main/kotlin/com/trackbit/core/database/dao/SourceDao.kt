package com.trackbit.core.database.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Transaction
import com.trackbit.core.database.entity.ExerciseSourceEntity
import com.trackbit.core.database.entity.QueueEntryEntity
import com.trackbit.core.database.entity.QueueWithEntries
import com.trackbit.core.model.Prescription
import kotlinx.coroutines.flow.Flow

/** The cached exercise sources and their queues. Only [SyncDao] writes them. */
@Dao
abstract class SourceDao {
    @Query("SELECT * FROM exercise_sources ORDER BY ordinal")
    abstract fun observeSources(): Flow<List<ExerciseSourceEntity>>

    @Transaction
    @Query("SELECT * FROM source_queues WHERE `key` = :key")
    abstract fun observeQueue(key: String): Flow<QueueWithEntries?>

    /** [listItemUuid]'s prescription, from whichever cached queue holds that item; null if none does or it has none. */
    suspend fun prescription(listItemUuid: String): Prescription? = entryOf(listItemUuid)?.prescription

    // An item has one prescription, whichever queue it appears in (a list, or a program's routine).
    @Query("SELECT * FROM queue_entries WHERE listItemUuid = :listItemUuid LIMIT 1")
    protected abstract suspend fun entryOf(listItemUuid: String): QueueEntryEntity?
}
