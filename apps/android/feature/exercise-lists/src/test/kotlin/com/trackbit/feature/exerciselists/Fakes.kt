package com.trackbit.feature.exerciselists

import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ExerciseLibraryRepository
import com.trackbit.core.data.SyncResult
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.UnitSystem
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.yield
import java.lang.reflect.Proxy

/**
 * The catalog and limits the list screens read: a server's [exercises] and [limits], and Room's
 * copy, which [refresh] fills. A non-null [failWith] fails a refresh ([ConfigError.Offline] as offline).
 */
class FakeExerciseLibraryRepository : ExerciseLibraryRepository by unused() {
    var exercises = listOf<Exercise>()
    var limits: EffectiveLimits? = null
    var failWith: ConfigError? = null

    private val room = MutableStateFlow<List<Exercise>?>(null)
    private val roomLimits = MutableStateFlow<EffectiveLimits?>(null)

    override fun exercises(): Flow<List<Exercise>?> = room

    override fun limits(): Flow<EffectiveLimits?> = roomLimits

    override suspend fun refresh(): SyncResult {
        yield()
        return when (failWith) {
            null -> {
                room.value = exercises
                roomLimits.value = limits
                SyncResult.Done
            }
            ConfigError.Offline -> SyncResult.Retry
            else -> SyncResult.Failed
        }
    }
}

class FakeAuthRepository(units: UnitSystem = UnitSystem.Metric) : AuthRepository by unused() {
    override val state = MutableStateFlow<AuthState>(AuthState.SignedIn(user(units)))
}

fun user(units: UnitSystem) = SessionUser(
    id = "u1", name = "Ana", email = "ana@example.com", emailVerified = true, image = null,
    role = "user", locale = "en", timezone = "UTC", unitSystem = units,
    exerciseLogCardStyle = ExerciseLogCardStyle.Classic, preferredExerciseSource = null,
)

fun exercise(n: Int, name: String = "Exercise $n", category: String = "strength") = Exercise(
    uuid = exerciseUuid(n), userId = null, name = name, description = null, category = category,
    defaultWeightUnit = "kg", defaultDistanceUnit = "km", lastPerformance = null, muscleGroups = emptyList(), frozen = false,
)

private inline fun <reified T> unused(): T = Proxy.newProxyInstance(T::class.java.classLoader, arrayOf(T::class.java)) { _, method, _ ->
    error("${method.name} is not part of this test")
} as T
