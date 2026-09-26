package com.trackbit.core.model

import kotlinx.serialization.Serializable

/** `POST /api/auth/sign-in/email`. The session token comes back in the `set-auth-token` header. */
@Serializable
data class SignInRequest(
    val email: String,
    val password: String,
)
