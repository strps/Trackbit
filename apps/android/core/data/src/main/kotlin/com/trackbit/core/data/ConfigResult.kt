package com.trackbit.core.data

import com.trackbit.core.model.HabitType
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult

/** What a config call (habits, and later the library, lists and account) came back with. */
sealed interface ConfigResult<out T> {
    data class Success<T>(val value: T) : ConfigResult<T>
    data class Failure(val error: ConfigError) : ConfigResult<Nothing>
}

/** Why a config call failed, in the terms a screen shows (the web's `errors:limits.*` copy). */
sealed interface ConfigError {
    /** No response: config needs a connection. */
    data object Offline : ConfigError

    data object HabitFrozen : ConfigError

    data class HabitLimitReached(val maxHabits: Int) : ConfigError

    /** [type] isn't in the role's [allowed] types. */
    data class HabitTypeNotAllowed(val type: HabitType?, val allowed: List<HabitType>) : ConfigError

    /** Gone on the server (deleted elsewhere). */
    data object NotFound : ConfigError

    /** Anything else: a refused value, a server error. */
    data object Failed : ConfigError
}

internal fun <T> ApiResult<T>.toConfigResult(type: HabitType? = null): ConfigResult<T> = when (this) {
    is ApiResult.Success -> ConfigResult.Success(value)
    is ApiResult.Failure -> ConfigResult.Failure(
        when (val e = error) {
            is ApiError.Network -> ConfigError.Offline
            is ApiError.HabitFrozen -> ConfigError.HabitFrozen
            is ApiError.HabitLimitReached -> ConfigError.HabitLimitReached(e.maxHabits ?: 0)
            is ApiError.HabitTypeNotAllowed ->
                ConfigError.HabitTypeNotAllowed(type, e.allowed.mapNotNull { wire -> HabitType.entries.find { it.wire == wire } })
            is ApiError.NotFound -> ConfigError.NotFound
            else -> ConfigError.Failed
        },
    )
}
