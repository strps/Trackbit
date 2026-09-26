package com.trackbit.app

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.trackbit.core.data.sync.PeriodicSync
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.android.HiltAndroidApp
import dagger.hilt.components.SingletonComponent
import javax.inject.Inject

@HiltAndroidApp
class TrackbitApplication : Application(), Configuration.Provider {
    @Inject lateinit var periodicSync: PeriodicSync

    override fun onCreate() {
        super.onCreate()
        periodicSync.start()
    }

    // From the component, not an injected field: WorkManager may initialize (a sign-out hook
    // cancelling work at startup) while this object's fields are still being injected.
    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(EntryPointAccessors.fromApplication<WorkerFactoryEntryPoint>(this).workerFactory())
            .build()

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface WorkerFactoryEntryPoint {
        fun workerFactory(): HiltWorkerFactory
    }
}
