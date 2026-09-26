package com.trackbit.core.data.sync

import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkRequest
import androidx.work.await
import java.util.concurrent.TimeUnit
import javax.inject.Inject

/** Background work that runs [TrackerSync]. */
internal interface SyncScheduler {
    /** Sends the outbox as soon as there is a connection. Call it after queuing an op. */
    fun flushOutbox()

    /** Syncs every 15 minutes while there is a connection. Idempotent. */
    fun schedulePeriodicSync()

    /** Cancels all of it, running work included. */
    suspend fun cancelAll()
}

internal class WorkManagerSyncScheduler @Inject constructor(
    private val workManager: WorkManager,
) : SyncScheduler {
    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    override fun flushOutbox() {
        val request = OneTimeWorkRequestBuilder<OutboxWorker>()
            .setConstraints(online)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, WorkRequest.DEFAULT_BACKOFF_DELAY_MILLIS, TimeUnit.MILLISECONDS)
            .addTag(TAG)
            .build()
        // Append, not keep: a flush that is finishing may already have read an empty outbox,
        // and the op just queued must not wait for the next trigger.
        workManager.enqueueUniqueWork(OUTBOX_WORK, ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }

    override fun schedulePeriodicSync() {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)
            .setConstraints(online)
            .addTag(TAG)
            .build()
        workManager.enqueueUniquePeriodicWork(PERIODIC_SYNC_WORK, ExistingPeriodicWorkPolicy.KEEP, request)
    }

    override suspend fun cancelAll() {
        workManager.cancelAllWorkByTag(TAG).await()
    }

    companion object {
        const val TAG = "tracker-sync"
        const val OUTBOX_WORK = "tracker-outbox"
        const val PERIODIC_SYNC_WORK = "tracker-sync-periodic"
    }
}
