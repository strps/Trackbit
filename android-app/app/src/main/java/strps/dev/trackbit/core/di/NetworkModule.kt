package strps.dev.trackbit.core.di

import android.content.Context
import strps.dev.trackbit.core.network.TokenManager
import strps.dev.trackbit.core.network.createTrackbitHttpClient
import strps.dev.trackbit.feature.auth.AuthRepository
import strps.dev.trackbit.feature.auth.AuthRepositoryImpl
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.ktor.client.HttpClient
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class) // Live as long as the app lives
object NetworkModule {

    @Provides
    @Singleton
    fun provideTokenManager(@ApplicationContext context: Context): TokenManager {
        return TokenManager(context)
    }

    @Provides
    @Singleton
    fun provideHttpClient(tokenManager: TokenManager): HttpClient {
        return createTrackbitHttpClient(tokenManager)
    }

    @Provides
    @Singleton
    fun provideAuthRepository(
        httpClient: HttpClient,
        tokenManager: TokenManager
    ): AuthRepository {
        return AuthRepositoryImpl(httpClient, tokenManager)
    }
}