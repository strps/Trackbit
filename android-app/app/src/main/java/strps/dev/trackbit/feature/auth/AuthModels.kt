package strps.dev.trackbit.feature.auth

import kotlinx.serialization.Serializable

@Serializable
data class SignInRequest(
    val email: String,
    val password: String
)

// Better-Auth returns the token alongside user data on successful authentication
@Serializable
data class AuthResponse(
    val token: String,
    val user: UserInfo
)

@Serializable
data class UserInfo(
    val id: String,
    val email: String,
    val name: String
)