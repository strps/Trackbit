package com.trackbit.core.database.entity

import androidx.room.Embedded
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.Relation
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.ExerciseListItem
import com.trackbit.core.model.MuscleGroup
import java.time.Instant

// The rest of the config the settings screens read, as of its last pull (habits and exercises
// have their own tables): the user's exercise lists, the muscle group taxonomy and the role's
// limits. [ConfigPullEntity] records which of them Room holds.

/** A list of `GET /api/exercise-lists`, without its items ([ExerciseListItemEntity]). */
@Entity(tableName = ExerciseListEntity.TABLE)
data class ExerciseListEntity(
    @PrimaryKey val uuid: String,
    val name: String,
    val description: String?,
    /** Its place in the user's order. */
    val position: Int,
    val frozen: Boolean,
) {
    companion object {
        const val TABLE = "exercise_lists"
    }
}

/** An item of a list, at [position] within it; the `target*` fields and [restSeconds] are its prescription. */
@Entity(
    tableName = ExerciseListItemEntity.TABLE,
    foreignKeys = [
        ForeignKey(entity = ExerciseListEntity::class, parentColumns = ["uuid"], childColumns = ["listUuid"], onDelete = ForeignKey.CASCADE),
    ],
    indices = [Index("listUuid")],
)
data class ExerciseListItemEntity(
    @PrimaryKey val uuid: String,
    val listUuid: String,
    /** Not a foreign key: the catalog is replaced on its own pulls and may lag behind. */
    val exerciseUuid: String,
    val position: Int,
    val targetSets: Int?,
    val targetReps: Int?,
    /** Kilograms. */
    val targetWeight: Double?,
    /** Seconds. */
    val targetDuration: Int?,
    /** Kilometres. */
    val targetDistance: Double?,
    val restSeconds: Int?,
    val notes: String?,
) {
    fun toItem() = ExerciseListItem(
        uuid = uuid,
        exerciseUuid = exerciseUuid,
        position = position,
        targetSets = targetSets,
        targetReps = targetReps,
        targetWeight = targetWeight,
        targetDuration = targetDuration,
        targetDistance = targetDistance,
        restSeconds = restSeconds,
        notes = notes,
    )

    companion object {
        const val TABLE = "exercise_list_items"
    }
}

data class ListWithItems(
    @Embedded val list: ExerciseListEntity,
    @Relation(parentColumn = "uuid", entityColumn = "listUuid")
    val items: List<ExerciseListItemEntity>,
) {
    fun toExerciseList() = ExerciseList(
        uuid = list.uuid,
        name = list.name,
        description = list.description,
        position = list.position,
        items = items.sortedBy { it.position }.map { it.toItem() },
        frozen = list.frozen,
    )
}

fun ExerciseList.toEntity() = ExerciseListEntity(uuid, name, description, position, frozen)

fun ExerciseListItem.toEntity(listUuid: String) = ExerciseListItemEntity(
    uuid = uuid,
    listUuid = listUuid,
    exerciseUuid = exerciseUuid,
    position = position,
    targetSets = targetSets,
    targetReps = targetReps,
    targetWeight = targetWeight,
    targetDuration = targetDuration,
    targetDistance = targetDistance,
    restSeconds = restSeconds,
    notes = notes,
)

/** A row of `GET /api/exercise-info/muscle-groups`, named in that request's locale. */
@Entity(tableName = MuscleGroupEntity.TABLE)
data class MuscleGroupEntity(
    @PrimaryKey val id: Int,
    val name: String,
    val slug: String,
    val parentId: Int?,
    val level: Int,
    val displayOrder: Int?,
) {
    fun toMuscleGroup() = MuscleGroup(id, name, slug, parentId, level, displayOrder)

    companion object {
        const val TABLE = "muscle_groups"
    }
}

fun MuscleGroup.toEntity() = MuscleGroupEntity(id, name, slug, parentId, level, displayOrder)

/** The role's caps from `GET /api/me/limits`: one row once pulled. The screens count the rows themselves. */
@Entity(tableName = LimitsEntity.TABLE)
data class LimitsEntity(
    @PrimaryKey val id: Int = ID,
    /** Null when nothing is capped (admins). */
    @Embedded val effective: EffectiveLimits?,
) {
    companion object {
        const val TABLE = "limits"
        const val ID = 0
    }
}

/** A part of the config, pulled as a whole. */
enum class ConfigPart { Habits, Exercises, Lists, MuscleGroups, Limits }

/**
 * When [part] was last pulled. Without a row Room doesn't hold it yet (rows `/today` brings
 * don't count for [ConfigPart.Habits]), which the screens tell apart from an empty one.
 */
@Entity(tableName = ConfigPullEntity.TABLE)
data class ConfigPullEntity(
    @PrimaryKey val part: ConfigPart,
    val pulledAt: Instant,
) {
    companion object {
        const val TABLE = "config_pulls"
    }
}
