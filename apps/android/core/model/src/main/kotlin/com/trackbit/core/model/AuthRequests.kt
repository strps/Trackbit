package com.trackbit.core.model

import kotlinx.serialization.EncodeDefault
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.Serializable

/** `POST /api/auth/sign-in/email`. The session token comes back in the `set-auth-token` header. */
@Serializable
data class SignInRequest(
    val email: String,
    val password: String,
)

/** `POST /api/auth/update-user` with only the profile name; see [AccountRules.NAME_LENGTH]. */
@Serializable
data class UpdateUserRequest(val name: String)

/** `POST /api/auth/update-user`'s answer. */
@Serializable
data class UpdateUserResponse(val status: Boolean)

/**
 * `POST /api/auth/change-password`. With [revokeOtherSessions] the server deletes every session,
 * the caller's included, and returns a new one in the `set-auth-token` header.
 */
@OptIn(ExperimentalSerializationApi::class)
@Serializable
data class ChangePasswordRequest(
    val currentPassword: String,
    val newPassword: String,
    @EncodeDefault val revokeOtherSessions: Boolean = true,
)

/** The server's rules for the account form (Better-Auth's and `auth.ts`'s user hooks). */
object AccountRules {
    /** The name, trimmed. */
    val NAME_LENGTH = 1..100

    /** Better-Auth's default `minPasswordLength`, also the web sign-up's. */
    const val PASSWORD_MIN = 8
}
