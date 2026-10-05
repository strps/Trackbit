package com.trackbit.core.data.di

import android.content.Context
import androidx.work.WorkManager
import com.trackbit.core.auth.SignOutHook
import com.trackbit.core.data.AnalyticsRepository
import com.trackbit.core.data.ClearDatabaseOnSignOut
import com.trackbit.core.data.DayClock
import com.trackbit.core.data.DefaultAnalyticsRepository
import com.trackbit.core.data.DefaultExerciseLibraryRepository
import com.trackbit.core.data.DefaultExerciseListsRepository
import com.trackbit.core.data.DefaultHabitsRepository
import com.trackbit.core.data.DefaultRestTimerRepository
import com.trackbit.core.data.DefaultSessionRepository
import com.trackbit.core.data.DefaultTrackerRepository
import com.trackbit.core.data.ExerciseLibraryRepository
import com.trackbit.core.data.ExerciseListsRepository
import com.trackbit.core.data.HabitsRepository
import com.trackbit.core.data.RestTimerRepository
import com.trackbit.core.data.SessionRepository
import com.trackbit.core.data.SystemDayClock
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
import java.time.Clock
import javax.inject.Qualifier
import javax.inject.Singleton
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

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
    abstract fun sessionRepository(repository: DefaultSessionRepository): SessionRepository

    @Binds
    abstract fun analyticsRepository(repository: DefaultAnalyticsRepository): AnalyticsRepository

    @Binds
    abstract fun habitsRepository(repository: DefaultHabitsRepository): HabitsRepository

    @Binds
    abstract fun exerciseLibraryRepository(repository: DefaultExerciseLibraryRepository): ExerciseLibraryRepository

    @Binds
    abstract fun exerciseListsRepository(repository: DefaultExerciseListsRepository): ExerciseListsRepository

    @Binds
    abstract fun restTimerRepository(repository: DefaultRestTimerRepository): RestTimerRepository

    @Binds
    abstract fun dayClock(clock: SystemDayClock): DayClock

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
