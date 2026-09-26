package com.trackbit.core.data.sync

import com.trackbit.core.auth.SignOutHook
import javax.inject.Inject

/**
 * Stops sync for the user who signed out: pending flushes and the periodic sync. A worker that is
 * already running can't write back either way; [TrackerSync] fences its writes on the session.
 */
internal class CancelSyncOnSignOut @Inject constructor(
    private val scheduler: SyncScheduler,
) : SignOutHook {
    override suspend fun onSignedOut() = scheduler.cancelAll()
}
