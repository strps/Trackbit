package com.trackbit.app

import android.app.Application
import android.content.res.Configuration as ResConfiguration
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.trackbit.app.timer.RestAlarm
import com.trackbit.app.timer.TimerNotifier
import com.trackbit.core.auth.DeviceTimeZoneSync
import com.trackbit.core.data.sync.LocalizedDataSync
import com.trackbit.core.data.sync.PeriodicSync
import com.trackbit.widget.WidgetUpdater
import com.trackbit.widget.preview.WidgetPreviews
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.android.HiltAndroidApp
import dagger.hilt.components.SingletonComponent
import javax.inject.Inject

@HiltAndroidApp
class TrackbitApplication : Application(), Configuration.Provider {
    @Inject lateinit var periodicSync: PeriodicSync
    @Inject lateinit var widgetUpdater: WidgetUpdater
    @Inject lateinit var timerNotifier: TimerNotifier
    @Inject lateinit var restAlarm: RestAlarm
    @Inject lateinit var widgetPreviews: WidgetPreviews
    @Inject lateinit var deviceTimeZoneSync: DeviceTimeZoneSync
    @Inject lateinit var localizedDataSync: LocalizedDataSync

    private var locales: String? = null

    override fun onCreate() {
        super.onCreate()
        periodicSync.start()
        widgetUpdater.start()
        timerNotifier.start()
        restAlarm.start()
        widgetPreviews.start()
        deviceTimeZoneSync.start()
        localizedDataSync.start()
        locales = resources.configuration.locales.toLanguageTags()
    }

    /** A new language (the per-app one, or the system's): widgets and their previews re-render in it. */
    override fun onConfigurationChanged(newConfig: ResConfiguration) {
        super.onConfigurationChanged(newConfig)
        val now = newConfig.locales.toLanguageTags()
        if (now == locales) return
        locales = now
        widgetUpdater.refreshAll()
        widgetPreviews.start()
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
