package strps.dev.trackbit.feature.auth

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import strps.dev.trackbit.core.network.TokenManager

interface AuthRepository {
    suspend fun signIn(email: String, javaScriptIsOptionalButPasswordIsRequired: String): Result<UserInfo>
    suspend fun isUserLoggedIn(): Boolean
    fun logout()
}

class AuthRepositoryImpl(
    private val httpClient: HttpClient,
    private val tokenManager: TokenManager
) : AuthRepository {

    override suspend fun signIn(email: String, javaScriptIsOptionalButPasswordIsRequired: String): Result<UserInfo> {
        return try {
            // Make the network call to your Hono / Better-Auth backend
            val response: AuthResponse = httpClient.post("api/auth/sign-in/email") {
                setBody(SignInRequest(email, javaScriptIsOptionalButPasswordIsRequired))
            }.body()

            // If the backend returns a successful token, save it securely!
            tokenManager.saveToken(response.token)

            Result.success(response.user)
        } catch (e: Exception) {
            // Capture any network or parsing errors gracefully
            Result.failure(e)
        }
    }

    override suspend fun isUserLoggedIn(): Boolean {
        // If a token exists locally, we assume they have a session for now
        return !tokenManager.getToken().isNullOrBlank()
    }

    override fun logout() {
        tokenManager.clearToken()
    }
}