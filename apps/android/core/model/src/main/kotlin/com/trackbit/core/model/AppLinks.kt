package com.trackbit.core.model

import java.time.LocalDate

/**
 * Links into the app's screens, for parts of it that can't name its routes (widgets). The app's
 * nav graph declares them as deep links; they're opened by explicit intent, never by other apps.
 */
object AppLinks {
    /** A workout habit's session screen: `$SESSION/{habitUuid}/{day}`, the day an ISO date. */
    const val SESSION = "trackbit://session"

    fun session(habitUuid: String, day: LocalDate): String = "$SESSION/$habitUuid/$day"
}
