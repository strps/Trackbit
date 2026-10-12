package com.trackbit.core.network.di

import com.trackbit.core.network.NetworkConfig
import com.trackbit.core.network.RequestLanguage
import com.trackbit.core.network.SessionTokenSource
import com.trackbit.core.network.service.AuthService
import com.trackbit.core.network.service.ExerciseListService
import com.trackbit.core.network.service.ExerciseService
import com.trackbit.core.network.service.HabitsService
import com.trackbit.core.network.service.IssueService
import com.trackbit.core.network.service.MeService
import com.trackbit.core.network.service.TrackerService
import com.trackbit.core.network.trackbitRetrofit
import com.trackbit.core.network.withTrackbitHeaders
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.create
import javax.inject.Qualifier
import javax.inject.Singleton

/**
 * A client without the API's headers (no session token), for public URLs that aren't the API, such
 * as exercise media. It shares the API client's connections and threads.
 */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class PublicHttpClient

/** Needs a [NetworkConfig] (from `app`), a [SessionTokenSource] and a [RequestLanguage] (from `core:auth`). */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides
    @Singleton
    @PublicHttpClient
    fun publicOkHttpClient(): OkHttpClient = OkHttpClient()

    @Provides
    @Singleton
    fun okHttpClient(@PublicHttpClient public: OkHttpClient, tokens: SessionTokenSource, language: RequestLanguage): OkHttpClient =
        public.withTrackbitHeaders(tokens, language)

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

    @Provides
    @Singleton
    fun issueService(retrofit: Retrofit): IssueService = retrofit.create()
}
