package com.trackbit.core.model

import com.trackbit.core.model.serialization.InstantSerializer
import kotlinx.serialization.Serializable
import java.time.Instant

/** `GET /api/auth/get-session` when signed in (the body is `null` otherwise). */
@Serializable
data class SessionResponse(
    val session: AuthSession,
    val user: SessionUser,
)

@Serializable
data class AuthSession(
    val id: String,
    val userId: String,
    @Serializable(with = InstantSerializer::class) val expiresAt: Instant,
)

@Serializable
data class SessionUser(
    val id: String,
    val name: String,
    val email: String,
    val emailVerified: Boolean,
    val image: String?,
    val role: String,
    /** One of [LOCALES]. */
    val locale: String,
    /** IANA zone; the server's "today" for this user. */
    val timezone: String,
    val unitSystem: UnitSystem,
    val exerciseLogCardStyle: ExerciseLogCardStyle,
    /** `list:12`, `program:3` or `computed:…`; null means browse mode. */
    val preferredExerciseSource: String?,
    /**
     * Seconds of rest after each set, unless its list item prescribes some; 0 = no rest timer.
     * Defaults to the server's column default, so a user cached by an older build still decodes.
     */
    val defaultRestSeconds: Int = DEFAULT_REST_SECONDS,
) {
    companion object {
        const val DEFAULT_REST_SECONDS = 90

        /** The languages the apps ship, the server's `SUPPORTED_LOCALES`. */
        val LOCALES = listOf("en", "es")

        /** The server's range for [defaultRestSeconds]. */
        val REST_SECONDS_RANGE = 0..3600
    }
}
