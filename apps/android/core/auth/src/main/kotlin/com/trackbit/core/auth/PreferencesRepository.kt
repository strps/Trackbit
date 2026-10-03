package com.trackbit.core.auth

import com.trackbit.core.auth.di.AuthScope
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.PreferencesRequest
import com.trackbit.core.model.PreferredExerciseSourceRequest
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.network.safeCall
import com.trackbit.core.network.service.MeService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * The signed-in user's preferences, which live on the user row and come back with the session
 * ([AuthState.SignedIn]'s user). A change shows at once in the cached user, then goes to the
 * server; offline, the next session refresh brings the server's value back.
 */
interface PreferencesRepository {
    /** The session picker's source: a source key such as `list:12`, or null for browse mode. */
    suspend fun setPreferredExerciseSource(key: String?)

    /** Seconds of rest after each set, in [SessionUser.REST_SECONDS_RANGE]; 0 turns the rest timer off. */
    suspend fun setDefaultRestSeconds(seconds: Int)

    /** One of [SessionUser.LOCALES]. The app's language follows it (see `AppLanguage` in `app`). */
    suspend fun setLocale(locale: String)

    suspend fun setUnitSystem(unitSystem: UnitSystem)

    suspend fun setExerciseLogCardStyle(style: ExerciseLogCardStyle)

    /** An IANA zone; [DeviceTimeZoneSync] keeps it the device's. */
    suspend fun setTimezone(zone: String)
}

internal class DefaultPreferencesRepository @Inject constructor(
    private val store: SessionStore,
    private val meService: MeService,
    @AuthScope private val scope: CoroutineScope,
) : PreferencesRepository {
    override suspend fun setPreferredExerciseSource(key: String?) {
        val token = store.token() ?: return
        store.updateUser(ifToken = token) { it.copy(preferredExerciseSource = key) }
        // Outlives the caller (a screen being closed).
        scope.launch { safeCall { meService.updatePreferredExerciseSource(PreferredExerciseSourceRequest(key)) } }
    }

    override suspend fun setDefaultRestSeconds(seconds: Int) =
        update(PreferencesRequest(defaultRestSeconds = seconds)) { it.copy(defaultRestSeconds = seconds) }

    override suspend fun setLocale(locale: String) {
        require(locale in SessionUser.LOCALES) { "Unsupported locale: $locale" }
        update(PreferencesRequest(locale = locale)) { it.copy(locale = locale) }
    }

    override suspend fun setUnitSystem(unitSystem: UnitSystem) =
        update(PreferencesRequest(unitSystem = unitSystem)) { it.copy(unitSystem = unitSystem) }

    override suspend fun setExerciseLogCardStyle(style: ExerciseLogCardStyle) =
        update(PreferencesRequest(exerciseLogCardStyle = style)) { it.copy(exerciseLogCardStyle = style) }

    override suspend fun setTimezone(zone: String) =
        update(PreferencesRequest(timezone = zone)) { it.copy(timezone = zone) }

    /** The cached user first, then one PATCH that outlives the caller. */
    private suspend fun update(request: PreferencesRequest, change: (SessionUser) -> SessionUser) {
        val token = store.token() ?: return
        store.updateUser(ifToken = token, change)
        scope.launch { safeCall { meService.updatePreferences(request) } }
    }
}
