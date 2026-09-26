package com.trackbit.core.designsystem.icon

import androidx.annotation.DrawableRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.painter.Painter
import androidx.compose.ui.res.painterResource
import com.trackbit.core.designsystem.R
import com.trackbit.core.model.HabitIcon

/**
 * The habit's Lucide glyph, generated from the web's icon registry. A stroked outline in black:
 * tint it (Compose `Icon` does, Glance needs `ColorFilter.tint`). An id this build doesn't know
 * already decodes to [HabitIcon.Star].
 */
@get:DrawableRes
val HabitIcon.drawableRes: Int
    get() = when (this) {
        HabitIcon.Book -> R.drawable.ic_habit_book
        HabitIcon.Dumbbell -> R.drawable.ic_habit_dumbbell
        HabitIcon.Code -> R.drawable.ic_habit_code
        HabitIcon.Water -> R.drawable.ic_habit_water
        HabitIcon.Sun -> R.drawable.ic_habit_sun
        HabitIcon.Moon -> R.drawable.ic_habit_moon
        HabitIcon.Music -> R.drawable.ic_habit_music
        HabitIcon.Work -> R.drawable.ic_habit_work
        HabitIcon.Coffee -> R.drawable.ic_habit_coffee
        HabitIcon.Ban -> R.drawable.ic_habit_ban
        HabitIcon.Alert -> R.drawable.ic_habit_alert
        HabitIcon.Home -> R.drawable.ic_habit_home
        HabitIcon.Star -> R.drawable.ic_habit_star
        HabitIcon.Heart -> R.drawable.ic_habit_heart
        HabitIcon.Trees -> R.drawable.ic_habit_trees
    }

@Composable
fun HabitIcon.painter(): Painter = painterResource(drawableRes)
