package com.trackbit.core.data

import com.trackbit.core.model.ExerciseListRules
import com.trackbit.core.model.HabitType
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult

/** What a config call (habits, the exercise library, lists) came back with. */
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

    /** A custom exercise over the role's limits: read-only until one is deleted. */
    data object CustomExerciseFrozen : ConfigError

    data class CustomExerciseLimitReached(val maxCustomExercises: Int) : ConfigError

    /** The user already has a custom exercise with that name. */
    data object ExerciseNameTaken : ConfigError

    /** A list over the role's cap: read-only until it or another one is deleted. */
    data object ExerciseListFrozen : ConfigError

    data class ExerciseListLimitReached(val maxExerciseLists: Int) : ConfigError

    /** The user already has a list with that name. */
    data object ExerciseListNameTaken : ConfigError

    /** The list already holds [maxItems] exercises. */
    data class ExerciseListFull(val maxItems: Int) : ConfigError

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
            ApiError.HabitFrozen -> ConfigError.HabitFrozen
            is ApiError.HabitLimitReached -> ConfigError.HabitLimitReached(e.maxHabits ?: 0)
            is ApiError.HabitTypeNotAllowed ->
                ConfigError.HabitTypeNotAllowed(type, e.allowed.mapNotNull { wire -> HabitType.entries.find { it.wire == wire } })
            ApiError.CustomExerciseFrozen -> ConfigError.CustomExerciseFrozen
            is ApiError.CustomExerciseLimitReached -> ConfigError.CustomExerciseLimitReached(e.maxCustomExercises ?: 0)
            ApiError.ExerciseNameTaken -> ConfigError.ExerciseNameTaken
            ApiError.ExerciseListFrozen -> ConfigError.ExerciseListFrozen
            is ApiError.ExerciseListLimitReached -> ConfigError.ExerciseListLimitReached(e.maxExerciseLists ?: 0)
            ApiError.ExerciseListNameTaken -> ConfigError.ExerciseListNameTaken
            is ApiError.ExerciseListFull -> ConfigError.ExerciseListFull(e.maxItems ?: ExerciseListRules.MAX_ITEMS)
            is ApiError.NotFound -> ConfigError.NotFound
            else -> ConfigError.Failed
        },
    )
}
