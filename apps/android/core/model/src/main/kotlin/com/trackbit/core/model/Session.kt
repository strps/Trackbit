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
    /** `en` or `es`. */
    val locale: String,
    /** IANA zone; the server's "today" for this user. */
    val timezone: String,
    val unitSystem: UnitSystem,
    val exerciseLogCardStyle: ExerciseLogCardStyle,
    /** `list:12`, `program:3` or `computed:…`; null means browse mode. */
    val preferredExerciseSource: String?,
)
