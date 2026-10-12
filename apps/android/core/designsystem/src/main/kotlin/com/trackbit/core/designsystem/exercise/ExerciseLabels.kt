package com.trackbit.core.designsystem.exercise

import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.trackbit.core.i18n.R
import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseDifficulty
import com.trackbit.core.model.ExerciseEquipment

// The names of an exercise's vocabularies, shared by the library, its form and the info sheet.

/** `exercises:category.*`. */
@get:StringRes
val ExerciseCategory.labelRes: Int
    get() = when (this) {
        ExerciseCategory.Cardio -> R.string.exercises_category_cardio
        ExerciseCategory.Flexibility -> R.string.exercises_category_flexibility
        else -> R.string.exercises_category_strength
    }

/** `exercises:equipment.*`; null for a value this build doesn't know. */
@get:StringRes
val ExerciseEquipment.labelRes: Int?
    get() = when (this) {
        ExerciseEquipment.Barbell -> R.string.exercises_equipment_barbell
        ExerciseEquipment.Dumbbell -> R.string.exercises_equipment_dumbbell
        ExerciseEquipment.Kettlebell -> R.string.exercises_equipment_kettlebell
        ExerciseEquipment.Machine -> R.string.exercises_equipment_machine
        ExerciseEquipment.Cable -> R.string.exercises_equipment_cable
        ExerciseEquipment.Bodyweight -> R.string.exercises_equipment_bodyweight
        ExerciseEquipment.Band -> R.string.exercises_equipment_band
        ExerciseEquipment.Bench -> R.string.exercises_equipment_bench
        ExerciseEquipment.PullUpBar -> R.string.exercises_equipment_pull_up_bar
        ExerciseEquipment.Other -> R.string.exercises_equipment_other
        ExerciseEquipment.Unknown -> null
    }

/** `exercises:difficulty.*`; null for a value this build doesn't know. */
@get:StringRes
val ExerciseDifficulty.labelRes: Int?
    get() = when (this) {
        ExerciseDifficulty.Beginner -> R.string.exercises_difficulty_beginner
        ExerciseDifficulty.Intermediate -> R.string.exercises_difficulty_intermediate
        ExerciseDifficulty.Advanced -> R.string.exercises_difficulty_advanced
        ExerciseDifficulty.Unknown -> null
    }

/** The category as the web's colored badge (orange / blue / emerald). */
@Composable
fun CategoryBadge(category: ExerciseCategory, modifier: Modifier = Modifier) {
    val (background, foreground) = category.badgeColors()
    Text(
        stringResource(category.labelRes),
        style = MaterialTheme.typography.labelSmall,
        color = foreground,
        modifier = modifier.background(background, RoundedCornerShape(6.dp)).padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

/** The web's category badge colors, on either theme. */
@Composable
private fun ExerciseCategory.badgeColors(): Pair<Color, Color> {
    val dark = MaterialTheme.colorScheme.surface.luminance() < 0.5f
    return when (this) {
        ExerciseCategory.Cardio -> if (dark) Color(0x4D1E3A8A) to Color(0xFF93C5FD) else Color(0xFFDBEAFE) to Color(0xFF1D4ED8)
        ExerciseCategory.Flexibility -> if (dark) Color(0x4D064E3B) to Color(0xFF6EE7B7) else Color(0xFFD1FAE5) to Color(0xFF047857)
        else -> if (dark) Color(0x4D7C2D12) to Color(0xFFFDBA74) else Color(0xFFFFEDD5) to Color(0xFFC2410C)
    }
}
