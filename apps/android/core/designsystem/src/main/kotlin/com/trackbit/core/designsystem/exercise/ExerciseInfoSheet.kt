package com.trackbit.core.designsystem.exercise

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.snapping.rememberSnapFlingBehavior
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.trackbit.core.designsystem.format.formatDuration
import com.trackbit.core.designsystem.format.formatNumber
import com.trackbit.core.designsystem.format.kgToDisplay
import com.trackbit.core.designsystem.format.weightUnit
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseDifficulty
import com.trackbit.core.model.ExerciseEquipment
import com.trackbit.core.model.ExerciseMediaRef
import com.trackbit.core.model.MuscleGroupRole
import com.trackbit.core.model.RecentLog
import com.trackbit.core.model.SetValues
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.model.exerciseFamily
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

/**
 * What an exercise is, like the web's `ExerciseInfoSheet`: its main information, then its
 * instructions, then everything else that helps while doing it. Its variants open in the same
 * sheet, with a way back.
 *
 * It reads [catalog] (Room's, so it works offline) for the exercise and its family.
 * [lastTime] gives an exercise's latest log with sets other than the one the sheet was opened
 * from. [onEdit] opens the form for one of the user's own exercises; null offers no edit.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExerciseInfoSheet(
    exerciseUuid: String,
    catalog: List<Exercise>,
    units: UnitSystem,
    lastTime: (exerciseUuid: String) -> Flow<RecentLog?>,
    onDismiss: () -> Unit,
    onEdit: ((exerciseUuid: String) -> Unit)? = null,
) {
    // The variants opened from it, in order.
    var trail by rememberSaveable(exerciseUuid) { mutableStateOf(listOf<String>()) }
    val shownUuid = trail.lastOrNull() ?: exerciseUuid
    val exercise = catalog.find { it.uuid == shownUuid }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 12.dp, end = 24.dp)) {
            if (trail.isNotEmpty()) {
                IconButton(onClick = { trail = trail.dropLast(1) }) {
                    Icon(painterResource(UiIcons.ArrowLeft), stringResource(R.string.exercises_info_back))
                }
            }
            Text(
                exercise?.name ?: stringResource(R.string.exercises_info_not_found),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = if (trail.isEmpty()) 12.dp else 0.dp),
            )
        }
        if (exercise != null) {
            ExerciseInfo(
                exercise = exercise,
                catalog = catalog,
                units = units,
                lastTime = lastTime,
                onOpenVariant = { trail = trail + it },
                // Only the user's own exercises are theirs to edit, and not while frozen.
                onEdit = onEdit?.takeIf { exercise.userId != null && !exercise.frozen },
            )
        }
    }
}

/** [lastTime]'s answer; null while it loads. */
private class LastTime(val log: RecentLog?)

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ExerciseInfo(
    exercise: Exercise,
    catalog: List<Exercise>,
    units: UnitSystem,
    lastTime: (String) -> Flow<RecentLog?>,
    onOpenVariant: (String) -> Unit,
    onEdit: ((String) -> Unit)?,
) {
    val last by remember(exercise.uuid) { lastTime(exercise.uuid).map(::LastTime) }.collectAsState(null)
    val family = remember(exercise, catalog) { exerciseFamily(exercise, catalog) }
    val difficulty = ExerciseDifficulty.of(exercise.difficulty).labelRes
    val equipment = exercise.equipment.mapNotNull { ExerciseEquipment.of(it).labelRes }

    Column(
        Modifier.verticalScroll(rememberScrollState()).padding(start = 24.dp, end = 24.dp, top = 8.dp, bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        // Main
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (exercise.media.isNotEmpty()) MediaStrip(exercise.media, exercise.name)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                CategoryBadge(ExerciseCategory.of(exercise.category))
                if (difficulty != null) Tag(stringResource(difficulty), outlined = true)
            }
            if (exercise.muscleGroups.isNotEmpty()) {
                InfoRow(stringResource(R.string.exercises_info_muscles)) {
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        // Primary first, as the server sends them; secondary ones muted.
                        for (group in exercise.muscleGroups) Tag(group.name, outlined = group.role == MuscleGroupRole.Secondary)
                    }
                }
            }
            if (equipment.isNotEmpty()) {
                InfoRow(stringResource(R.string.exercises_info_equipment)) {
                    Text(equipment.map { stringResource(it) }.joinToString(", "), style = MaterialTheme.typography.bodyMedium)
                }
            }
        }

        Section(stringResource(R.string.exercises_info_instructions)) {
            val steps = exercise.instructions
            if (steps != null) {
                StepList(steps, numbered = true)
            } else {
                Text(stringResource(R.string.exercises_info_no_instructions), color = MaterialTheme.colorScheme.onSurfaceVariant)
                if (onEdit != null) {
                    TextButton(onClick = { onEdit(exercise.uuid) }) { Text(stringResource(R.string.exercises_info_add_instructions)) }
                }
            }
        }

        Section(stringResource(R.string.exercises_info_other)) {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                InfoRow(stringResource(R.string.exercises_info_last_time)) {
                    last?.let { loaded ->
                        if (loaded.log != null) {
                            LastLog(loaded.log, units)
                        } else {
                            Text(stringResource(R.string.exercises_info_never_performed), color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                exercise.tips?.let { InfoRow(stringResource(R.string.exercises_info_tips)) { StepList(it, numbered = false) } }
                exercise.commonMistakes?.let { InfoRow(stringResource(R.string.exercises_info_common_mistakes)) { StepList(it, numbered = false) } }
                exercise.description?.let { InfoRow(stringResource(R.string.exercises_info_about)) { Text(it) } }
                if (family.isNotEmpty()) {
                    InfoRow(stringResource(R.string.exercises_info_variants)) {
                        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            for (member in family) {
                                OutlinedButton(onClick = { onOpenVariant(member.uuid) }) { Text(member.name) }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * The images, cover first, side by side to swipe through. Animated ones loop by themselves. Each
 * keeps its proportions, so nothing shifts as it loads.
 */
@Composable
private fun MediaStrip(media: List<ExerciseMediaRef>, name: String) {
    val state = rememberLazyListState()
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        val maxImageWidth = maxWidth
        LazyRow(
            state = state,
            flingBehavior = rememberSnapFlingBehavior(state),
            horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
            modifier = Modifier.fillMaxWidth(),
        ) {
            items(media, key = { it.uuid }) { image ->
                AsyncImage(
                    model = image.url,
                    contentDescription = image.alt ?: name,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier
                        .height(MEDIA_HEIGHT)
                        .widthIn(max = maxImageWidth)
                        .aspectRatio(image.width.toFloat() / image.height)
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant),
                )
            }
        }
    }
}

@Composable
private fun Section(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            title.uppercase(),
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        content()
    }
}

@Composable
private fun InfoRow(label: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.titleSmall)
        content()
    }
}

/** A numbered list of steps, or a bulleted one. */
@Composable
private fun StepList(entries: List<String>, numbered: Boolean) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        entries.forEachIndexed { i, entry ->
            Row {
                Text(if (numbered) "${i + 1}." else "•", modifier = Modifier.widthIn(min = 24.dp))
                Text(entry, modifier = Modifier.weight(1f))
            }
        }
    }
}

/** A filled chip, or an outlined, muted one. */
@Composable
private fun Tag(text: String, outlined: Boolean) {
    val shape = RoundedCornerShape(6.dp)
    Text(
        text,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = if (outlined) {
            Modifier.border(1.dp, MaterialTheme.colorScheme.outlineVariant, shape).padding(horizontal = 8.dp, vertical = 2.dp)
        } else {
            Modifier.background(MaterialTheme.colorScheme.surfaceVariant, shape).padding(horizontal = 8.dp, vertical = 2.dp)
        },
    )
}

/** The day of [log] and its sets, one per line. */
@Composable
private fun LastLog(log: RecentLog, units: UnitSystem) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(
            log.localDay.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM)),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        log.sets.forEachIndexed { i, set ->
            Row {
                Text(
                    stringResource(R.string.exercises_info_set_number, "${i + 1}"),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.widthIn(min = 56.dp),
                )
                Text(describe(set, units).ifEmpty { "-" }, modifier = Modifier.weight(1f))
            }
        }
    }
}

/** "8 reps · 60 kg · RPE 8", like the web's. */
@Composable
private fun describe(set: SetValues, units: UnitSystem): String = listOfNotNull(
    set.reps?.let { pluralStringResource(R.plurals.exercises_info_set_reps, it, it) },
    set.weight?.let { "${formatNumber(kgToDisplay(it, units))} ${weightUnit(units)}" },
    set.duration?.let { formatDuration(it.toLong()) },
    set.distance?.let { stringResource(R.string.exercises_info_set_distance_km, formatNumber(it)) },
    set.rpe?.let { stringResource(R.string.exercises_info_set_rpe, "$it") },
).joinToString(" · ")

private val MEDIA_HEIGHT = 224.dp
