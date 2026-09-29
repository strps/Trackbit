package com.trackbit.core.data.di

import android.content.Context
import androidx.work.WorkManager
import com.trackbit.core.auth.SignOutHook
import com.trackbit.core.data.ClearDatabaseOnSignOut
import com.trackbit.core.data.DefaultTrackerRepository
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.data.sync.CancelSyncOnSignOut
import com.trackbit.core.data.sync.SyncScheduler
import com.trackbit.core.data.sync.WorkManagerSyncScheduler
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import java.time.Clock
import javax.inject.Qualifier
import javax.inject.Singleton

/** Work that lives as long as the process. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
internal annotation class DataScope

@Module
@InstallIn(SingletonComponent::class)
internal abstract class DataModule {
    @Binds
    abstract fun trackerRepository(repository: DefaultTrackerRepository): TrackerRepository

    @Binds
    abstract fun syncScheduler(scheduler: WorkManagerSyncScheduler): SyncScheduler

    @Binds
    @IntoSet
    abstract fun clearDatabaseOnSignOut(hook: ClearDatabaseOnSignOut): SignOutHook

    @Binds
    @IntoSet
    abstract fun cancelSyncOnSignOut(hook: CancelSyncOnSignOut): SignOutHook

    companion object {
        @Provides
        @Singleton
        @DataScope
        fun scope(): CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

        /** Wall-clock time, for timers: a start instant survives reboots, elapsed-realtime doesn't. */
        @Provides
        fun clock(): Clock = Clock.systemUTC()

        /** Initialized on demand with the app's `Configuration.Provider` (Hilt's worker factory). */
        @Provides
        fun workManager(@ApplicationContext context: Context): WorkManager = WorkManager.getInstance(context)
    }
}
