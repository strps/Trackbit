package com.trackbit.app.di

import com.trackbit.app.BuildConfig
import com.trackbit.core.data.AppBuild
import com.trackbit.core.network.NetworkConfig
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
object AppModule {
    @Provides
    fun networkConfig(): NetworkConfig = NetworkConfig(baseUrl = BuildConfig.API_BASE_URL)

    @Provides
    fun appBuild(): AppBuild = AppBuild(BuildConfig.VERSION_NAME, BuildConfig.VERSION_CODE)
}
