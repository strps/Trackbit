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

/**
 * `POST /api/auth/sign-up/email`. No session comes back: the account must verify its email
 * first. [locale] and [timezone] are the device's, as the web sends its browser's; a blank
 * [inviteCode] is left out (the server would ignore it too).
 */
@Serializable
data class SignUpRequest(
    val name: String,
    val email: String,
    val password: String,
    val locale: String,
    val timezone: String,
    val inviteCode: String? = null,
)

/**
 * `POST /api/auth/request-password-reset`. The server emails a link to the web's reset page,
 * and answers the same whether or not the account exists.
 */
@Serializable
data class PasswordResetRequest(val email: String)

/**
 * `POST /api/auth/send-verification-email` without a session: mails a new link if [email] is
 * an unverified account, and answers the same either way.
 */
@Serializable
data class VerificationEmailRequest(val email: String)

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

    /** [languageTag]'s language if the apps ship it, else English (the web's `detectLocale`). */
    fun signUpLocale(languageTag: String): String =
        languageTag.substringBefore('-').lowercase().takeIf { it in SessionUser.LOCALES } ?: "en"
}
