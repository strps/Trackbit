package com.trackbit.core.auth

import com.trackbit.core.model.AccountRules
import com.trackbit.core.model.ChangePasswordRequest
import com.trackbit.core.model.UpdateUserRequest
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.safeCall
import com.trackbit.core.network.service.AuthService
import com.trackbit.core.network.service.changePassword
import javax.inject.Inject

/** The account's profile and password, through Better-Auth. Both need a connection. */
interface AccountRepository {
    /** Renames the user; [name] is trimmed and must fit [AccountRules.NAME_LENGTH]. */
    suspend fun updateName(name: String): ApiResult<Unit>

    /**
     * Changes the password and signs out every other device. The server ends this session too
     * and starts a new one, whose token the app adopts.
     */
    suspend fun changePassword(currentPassword: String, newPassword: String): ApiResult<Unit>
}

internal class DefaultAccountRepository @Inject constructor(
    private val store: SessionStore,
    private val authService: AuthService,
) : AccountRepository {
    override suspend fun updateName(name: String): ApiResult<Unit> {
        val trimmed = name.trim()
        require(trimmed.length in AccountRules.NAME_LENGTH) { "Name length out of range: ${trimmed.length}" }
        val token = store.token() ?: return SIGNED_OUT
        return when (val result = safeCall { authService.updateUser(UpdateUserRequest(trimmed)) }) {
            is ApiResult.Failure -> result
            is ApiResult.Success -> {
                store.updateUser(ifToken = token) { it.copy(name = trimmed) }
                ApiResult.Success(Unit)
            }
        }
    }

    override suspend fun changePassword(currentPassword: String, newPassword: String): ApiResult<Unit> {
        require(newPassword.length >= AccountRules.PASSWORD_MIN) { "Password too short" }
        val token = store.token() ?: return SIGNED_OUT
        val request = ChangePasswordRequest(currentPassword, newPassword)
        return when (val result = store.rotate(ifToken = token) { authService.changePassword(request) }) {
            is ApiResult.Failure -> result
            is ApiResult.Success -> ApiResult.Success(Unit)
        }
    }

    private companion object {
        val SIGNED_OUT = ApiResult.Failure(ApiError.Unauthorized(code = null, message = "Signed out"))
    }
}
