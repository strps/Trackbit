package com.trackbit.app

import android.app.Application
import android.content.res.Configuration as ResConfiguration
import android.os.Build
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import coil3.disk.DiskCache
import coil3.disk.directory
import coil3.gif.AnimatedImageDecoder
import coil3.network.okhttp.OkHttpNetworkFetcherFactory
import com.trackbit.app.timer.RestAlarm
import com.trackbit.app.timer.TimerNotifier
import com.trackbit.core.auth.DeviceTimeZoneSync
import com.trackbit.core.data.sync.LocalizedDataSync
import com.trackbit.core.data.sync.PeriodicSync
import com.trackbit.core.network.di.PublicHttpClient
import com.trackbit.widget.WidgetUpdater
import com.trackbit.widget.preview.WidgetPreviews
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.android.HiltAndroidApp
import dagger.hilt.components.SingletonComponent
import javax.inject.Inject
import okhttp3.OkHttpClient

@HiltAndroidApp
class TrackbitApplication : Application(), Configuration.Provider, SingletonImageLoader.Factory {
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

    /**
     * Exercise media: public URLs, loaded without the session token. The disk cache is used without
     * revalidating, so an image seen once also shows offline. Animated WebP plays from API 28
     * (`ImageDecoder`); before that it shows its first frame.
     */
    override fun newImageLoader(context: PlatformContext): ImageLoader {
        val client = EntryPointAccessors.fromApplication<ImageLoaderEntryPoint>(this).publicHttpClient()
        return ImageLoader.Builder(context)
            .components {
                add(OkHttpNetworkFetcherFactory(callFactory = { client }))
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) add(AnimatedImageDecoder.Factory())
            }
            .diskCache {
                DiskCache.Builder()
                    .directory(context.cacheDir.resolve("image_cache"))
                    .maxSizeBytes(IMAGE_CACHE_BYTES)
                    .build()
            }
            .build()
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface WorkerFactoryEntryPoint {
        fun workerFactory(): HiltWorkerFactory
    }

    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface ImageLoaderEntryPoint {
        @PublicHttpClient fun publicHttpClient(): OkHttpClient
    }

    private companion object {
        /** About 40 exercises' worth of media at the 2 MB cap; most images are far smaller. */
        const val IMAGE_CACHE_BYTES = 100L * 1024 * 1024
    }
}
