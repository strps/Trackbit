package com.trackbit.core.data

import com.trackbit.core.auth.SignOutHook
import com.trackbit.core.database.TrackbitDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject

/** Room holds one user's habits and pending writes; none of it may reach the next user. */
internal class ClearDatabaseOnSignOut @Inject constructor(
    private val database: TrackbitDatabase,
) : SignOutHook {
    override suspend fun onSignedOut() = withContext(Dispatchers.IO) { database.clearAllTables() }
}
