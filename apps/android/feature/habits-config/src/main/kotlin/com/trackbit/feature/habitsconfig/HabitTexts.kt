package com.trackbit.feature.habitsconfig

import androidx.annotation.StringRes
import com.trackbit.core.i18n.R
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.HabitType

/** The list's type badge (`habits:list.badge.*`). */
@get:StringRes
internal val HabitType.badgeRes: Int
    get() = when (this) {
        HabitType.Complex -> R.string.habits_list_badge_structured
        HabitType.Timed -> R.string.habits_list_badge_timed
        HabitType.Check -> R.string.habits_list_badge_check
        else -> R.string.habits_list_badge_count
    }

/** The form's tracking method title (`habits:type.*.label`). */
@get:StringRes
internal val HabitType.labelRes: Int
    get() = when (this) {
        HabitType.Complex -> R.string.habits_type_complex_label
        HabitType.Timed -> R.string.habits_type_timed_label
        HabitType.Check -> R.string.habits_type_check_label
        else -> R.string.habits_type_count_label
    }

@get:StringRes
internal val HabitType.descriptionRes: Int
    get() = when (this) {
        HabitType.Complex -> R.string.habits_type_complex_description
        HabitType.Timed -> R.string.habits_type_timed_description
        HabitType.Check -> R.string.habits_type_check_description
        else -> R.string.habits_type_count_description
    }

/** `habits:theme.*`. */
@get:StringRes
internal val ColorTheme.labelRes: Int
    get() = when (this) {
        ColorTheme.Green -> R.string.habits_theme_green
        ColorTheme.Blue -> R.string.habits_theme_blue
        ColorTheme.Orange -> R.string.habits_theme_orange
        ColorTheme.Purple -> R.string.habits_theme_purple
        ColorTheme.Rose -> R.string.habits_theme_rose
        ColorTheme.Fire -> R.string.habits_theme_fire
        ColorTheme.Custom, ColorTheme.Unknown -> R.string.habits_theme_custom
    }
