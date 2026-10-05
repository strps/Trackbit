package com.trackbit.core.network.di

import com.trackbit.core.network.NetworkConfig
import com.trackbit.core.network.RequestLanguage
import com.trackbit.core.network.SessionTokenSource
import com.trackbit.core.network.service.AuthService
import com.trackbit.core.network.service.ExerciseListService
import com.trackbit.core.network.service.ExerciseService
import com.trackbit.core.network.service.HabitsService
import com.trackbit.core.network.service.MeService
import com.trackbit.core.network.service.TrackerService
import com.trackbit.core.network.trackbitOkHttpClient
import com.trackbit.core.network.trackbitRetrofit
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.create
import javax.inject.Singleton

/** Needs a [NetworkConfig] (from `app`), a [SessionTokenSource] and a [RequestLanguage] (from `core:auth`). */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    fun okHttpClient(tokens: SessionTokenSource, language: RequestLanguage): OkHttpClient =
        trackbitOkHttpClient(tokens, language)

    @Provides
    @Singleton
    fun retrofit(config: NetworkConfig, client: OkHttpClient): Retrofit = trackbitRetrofit(config.baseUrl, client)

    @Provides
    @Singleton
    fun authService(retrofit: Retrofit): AuthService = retrofit.create()

    @Provides
    @Singleton
    fun trackerService(retrofit: Retrofit): TrackerService = retrofit.create()

    @Provides
    @Singleton
    fun habitsService(retrofit: Retrofit): HabitsService = retrofit.create()

    @Provides
    @Singleton
    fun exerciseService(retrofit: Retrofit): ExerciseService = retrofit.create()

    @Provides
    @Singleton
    fun exerciseListService(retrofit: Retrofit): ExerciseListService = retrofit.create()

    @Provides
    @Singleton
    fun meService(retrofit: Retrofit): MeService = retrofit.create()
}
