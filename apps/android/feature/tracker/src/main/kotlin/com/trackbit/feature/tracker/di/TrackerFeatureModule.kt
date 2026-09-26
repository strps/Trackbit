package com.trackbit.feature.tracker.di

import com.trackbit.feature.tracker.DayClock
import com.trackbit.feature.tracker.SystemDayClock
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
internal interface TrackerFeatureModule {
    @Binds
    fun dayClock(clock: SystemDayClock): DayClock
}
