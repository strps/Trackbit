package com.trackbit.core.data.sync

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.ListenableWorker
import androidx.work.WorkerParameters
import com.trackbit.core.data.SyncResult
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

/** Sends the outbox. Queued by every tracker write. */
@HiltWorker
internal class OutboxWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val sync: TrackerSync,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = sync.flush().toWorkResult()
}

/** Sends the outbox and pulls today's state (and history when due). Runs periodically. */
@HiltWorker
internal class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val sync: TrackerSync,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = sync.sync().toWorkResult()
}

/** Pulls requested history. Queued when a heatmap asks for more than Room has. */
@HiltWorker
internal class HistoryWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val sync: TrackerSync,
) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = sync.syncHistory().toWorkResult()
}

private fun SyncResult.toWorkResult(): ListenableWorker.Result = when (this) {
    SyncResult.Done -> ListenableWorker.Result.success()
    SyncResult.Retry -> ListenableWorker.Result.retry()
    // Signed out: nothing is left to send, and signing in schedules sync again.
    SyncResult.Failed, SyncResult.SignedOut -> ListenableWorker.Result.failure()
}
