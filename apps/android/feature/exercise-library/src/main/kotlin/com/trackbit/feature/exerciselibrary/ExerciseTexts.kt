package com.trackbit.feature.exerciselibrary

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.core.model.ExerciseCategory

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
