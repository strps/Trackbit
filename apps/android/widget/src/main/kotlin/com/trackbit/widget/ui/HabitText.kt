package com.trackbit.widget.ui

import android.content.Context
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.designsystem.format.displayText
import com.trackbit.core.i18n.R as I18nR

/** "1 / 8 · 3 day streak · Frozen": progress, a streak from 2 days on, and the frozen badge. */
internal fun TrackedHabit.detailsText(context: Context): String? = listOfNotNull(
    progress.displayText(type),
    streak?.takeIf { it >= 2 }?.let { context.resources.getQuantityString(I18nR.plurals.tracker_streak_badge, it, it) },
    context.getString(I18nR.string.errors_limits_frozen_badge).takeIf { frozen },
).takeIf { it.isNotEmpty() }?.joinToString(" · ")
