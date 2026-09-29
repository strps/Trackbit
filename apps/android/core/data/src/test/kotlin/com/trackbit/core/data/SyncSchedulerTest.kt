package com.trackbit.core.data

import android.content.Context
import androidx.test.core.app.ApplicationProvider
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.testing.WorkManagerTestInitHelper
import com.trackbit.core.data.sync.CancelSyncOnSignOut
import com.trackbit.core.data.sync.WorkManagerSyncScheduler
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class SyncSchedulerTest {
    private val workManager: WorkManager = ApplicationProvider.getApplicationContext<Context>().let {
        WorkManagerTestInitHelper.initializeTestWorkManager(it)
        WorkManager.getInstance(it)
    }
    private val scheduler = WorkManagerSyncScheduler(workManager)

    private fun states(name: String) = workManager.getWorkInfosForUniqueWork(name).get().map { it.state }

    @Test fun `sign-out cancels queued flushes, history pulls and the periodic sync`() = runTest {
        scheduler.flushOutbox()
        scheduler.flushOutbox()
        scheduler.syncHistory()
        scheduler.schedulePeriodicSync()
        scheduler.schedulePeriodicSync()
        assertEquals(1, states(WorkManagerSyncScheduler.PERIODIC_SYNC_WORK).size)
        assertEquals(1, states(WorkManagerSyncScheduler.HISTORY_WORK).size)

        CancelSyncOnSignOut(scheduler).onSignedOut()

        val all = states(WorkManagerSyncScheduler.OUTBOX_WORK) + states(WorkManagerSyncScheduler.HISTORY_WORK) +
            states(WorkManagerSyncScheduler.PERIODIC_SYNC_WORK)
        assertEquals(List(all.size) { WorkInfo.State.CANCELLED }, all)
    }
}
