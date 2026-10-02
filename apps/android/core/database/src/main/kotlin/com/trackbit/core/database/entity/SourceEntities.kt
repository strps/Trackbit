package com.trackbit.core.database.entity

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.Relation
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.Prescription
import com.trackbit.core.model.QueueEmptyReason
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.model.SourceCapabilities
import java.time.Instant

// The session picker's exercise sources (`GET /api/exercise-sources`) and the queues they resolve
// to (`GET /api/exercise-sources/:key`), as of their last pull: server data only, nothing local
// is pending against them, so a pull replaces them. They keep the picker and prescriptions
// working offline.

/** A source the dropdown lists, named by its canonical key (`list:12`). */
@Entity(tableName = ExerciseSourceEntity.TABLE)
data class ExerciseSourceEntity(
    @PrimaryKey val key: String,
    /** Its place in the server's answer, which is the dropdown's order. */
    val ordinal: Int,
    val name: String?,
    val nameKey: String?,
    val itemCount: Int?,
    @Embedded val capabilities: SourceCapabilities,
    val frozen: Boolean,
) {
    fun toDescriptor() = ExerciseSourceDescriptor(key, name, nameKey, itemCount, capabilities, frozen)

    companion object {
        const val TABLE = "exercise_sources"
    }
}

fun ExerciseSourceDescriptor.toEntity(ordinal: Int) =
    ExerciseSourceEntity(key, ordinal, name, nameKey, itemCount, capabilities, frozen)

/** The last answer for a source's queue: its entries (in [QueueEntryEntity]) or that it is [gone]. */
@Entity(tableName = SourceQueueEntity.TABLE)
data class SourceQueueEntity(
    @PrimaryKey val key: String,
    /** The server no longer resolves it (404): a deleted list. The picker falls back to browse mode. */
    val gone: Boolean,
    val emptyReason: QueueEmptyReason?,
    val pulledAt: Instant,
) {
    companion object {
        const val TABLE = "source_queues"
    }
}

/** One entry of a queue, at [ordinal] in the server's order. */
@Entity(
    tableName = QueueEntryEntity.TABLE,
    primaryKeys = ["sourceKey", "ordinal"],
    foreignKeys = [
        ForeignKey(entity = SourceQueueEntity::class, parentColumns = ["key"], childColumns = ["sourceKey"], onDelete = ForeignKey.CASCADE),
    ],
    // A new set looks its log's prescription up by list item.
    indices = [Index("listItemId")],
)
data class QueueEntryEntity(
    val sourceKey: String,
    val ordinal: Int,
    /** Not a foreign key: the catalog is replaced wholesale and may lag behind. */
    val exerciseId: Int,
    val position: Int,
    val listItemId: Int?,
    /** Null when nothing is prescribed (the server never sends a prescription of all nulls). */
    @Embedded(prefix = "rx_") val prescription: Prescription?,
) {
    fun toEntry() = QueueEntry(exerciseId, position, listItemId, prescription)

    companion object {
        const val TABLE = "queue_entries"
    }
}

data class QueueWithEntries(
    @Embedded val queue: SourceQueueEntity,
    @Relation(parentColumn = "key", entityColumn = "sourceKey")
    val entries: List<QueueEntryEntity>,
)
