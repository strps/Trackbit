package com.trackbit.feature.exerciselibrary

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.luminance
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.ExerciseCategory

/** `exercises:category.*`. */
@get:StringRes
internal val ExerciseCategory.labelRes: Int
    get() = when (this) {
        ExerciseCategory.Cardio -> R.string.exercises_category_cardio
        ExerciseCategory.Flexibility -> R.string.exercises_category_flexibility
        else -> R.string.exercises_category_strength
    }

@get:StringRes
internal val ExerciseCategory.descriptionRes: Int
    get() = when (this) {
        ExerciseCategory.Cardio -> R.string.exercises_category_cardio_desc
        ExerciseCategory.Flexibility -> R.string.exercises_category_flexibility_desc
        else -> R.string.exercises_category_strength_desc
    }

@get:DrawableRes
internal val ExerciseCategory.icon: Int
    get() = when (this) {
        ExerciseCategory.Cardio -> UiIcons.Activity
        ExerciseCategory.Flexibility -> UiIcons.User
        else -> UiIcons.Dumbbell
    }

/** What a log of the category records (`exercises:field.*`), as the web's cards list it. */
internal val ExerciseCategory.fieldRes: List<Int>
    get() = when (this) {
        ExerciseCategory.Cardio -> listOf(R.string.exercises_field_laps, R.string.exercises_field_distance, R.string.exercises_field_duration)
        ExerciseCategory.Flexibility -> listOf(R.string.exercises_field_duration)
        else -> listOf(R.string.exercises_field_sets, R.string.exercises_field_reps, R.string.exercises_field_weight)
    }

/** The web's category badge colors (orange / blue / emerald), on either theme. */
@Composable
internal fun ExerciseCategory.badgeColors(): Pair<Color, Color> {
    val dark = MaterialTheme.colorScheme.surface.luminance() < 0.5f
    return when (this) {
        ExerciseCategory.Cardio -> if (dark) Color(0x4D1E3A8A) to Color(0xFF93C5FD) else Color(0xFFDBEAFE) to Color(0xFF1D4ED8)
        ExerciseCategory.Flexibility -> if (dark) Color(0x4D064E3B) to Color(0xFF6EE7B7) else Color(0xFFD1FAE5) to Color(0xFF047857)
        else -> if (dark) Color(0x4D7C2D12) to Color(0xFFFDBA74) else Color(0xFFFFEDD5) to Color(0xFFC2410C)
    }
}
