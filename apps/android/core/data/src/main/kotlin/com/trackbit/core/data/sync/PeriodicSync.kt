package com.trackbit.core.data.sync

import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.di.DataScope
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.filterIsInstance
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Keeps the periodic sync scheduled while someone is signed in. Sign-out cancels it
 * ([CancelSyncOnSignOut]); the next sign-in schedules it again. Call [start] once, from
 * `Application.onCreate`.
 */
@Singleton
class PeriodicSync @Inject internal constructor(
    private val auth: AuthRepository,
    private val scheduler: SyncScheduler,
    @DataScope private val scope: CoroutineScope,
) {
    fun start() {
        scope.launch {
            auth.state.filterIsInstance<AuthState.SignedIn>().collect { scheduler.schedulePeriodicSync() }
        }
    }
}
