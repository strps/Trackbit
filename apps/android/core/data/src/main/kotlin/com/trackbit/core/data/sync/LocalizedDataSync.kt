package com.trackbit.core.data.sync

import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.di.DataScope
import com.trackbit.core.database.entity.ConfigPart
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Re-pulls the server data Room keeps in the user's language (the exercise catalog and the
 * muscle group taxonomy) when that language changes, here or on another device. Requests ask
 * for the session's locale, so the pull already speaks the new one. Call [start] once, from
 * `Application.onCreate`.
 */
@Singleton
class LocalizedDataSync @Inject internal constructor(
    private val auth: AuthRepository,
    private val sync: TrackerSync,
    @DataScope private val scope: CoroutineScope,
) {
    fun start() {
        scope.launch {
            localeChanges(auth.state).collect { sync.syncConfig(ConfigPart.Exercises, ConfigPart.MuscleGroups) }
        }
    }
}

/**
 * One emission each time the signed-in user's locale changes. Not on sign-in, even as someone
 * else: Room starts from an empty catalog then anyway.
 */
internal fun localeChanges(auth: Flow<AuthState>): Flow<Unit> = flow {
    var last: Pair<String, String>? = null
    auth.filterIsInstance<AuthState.SignedIn>()
        .map { it.user.id to it.user.locale }
        .distinctUntilChanged()
        .collect { next ->
            val previous = last
            last = next
            if (previous != null && previous.first == next.first) emit(Unit)
        }
}
