package com.trackbit.core.auth.di

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.core.DataStoreFactory
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import androidx.datastore.dataStoreFile
import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.RegistryConfiguration
import com.google.crypto.tink.aead.AeadConfig
import com.google.crypto.tink.integration.android.AndroidKeysetManager
import com.trackbit.core.auth.AccountRepository
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.DefaultAccountRepository
import com.trackbit.core.auth.DefaultAuthRepository
import com.trackbit.core.auth.DefaultPreferencesRepository
import com.trackbit.core.auth.PreferencesRepository
import com.trackbit.core.auth.SessionSerializer
import com.trackbit.core.auth.SessionStore
import com.trackbit.core.auth.SignOutHook
import com.trackbit.core.auth.StoredSession
import com.trackbit.core.network.RequestLanguage
import com.trackbit.core.network.SessionTokenSource
import dagger.Binds
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.Multibinds
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import javax.inject.Qualifier
import javax.inject.Singleton

/** Work that must finish even if the screen that started it goes away. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
internal annotation class AuthScope

@Module
@InstallIn(SingletonComponent::class)
internal object AuthModule {
    @Provides
    @Singleton
    @AuthScope
    fun scope(): CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Provides
    @Singleton
    fun sessionDataStore(
        @ApplicationContext context: Context,
        @AuthScope scope: CoroutineScope,
    ): DataStore<StoredSession?> = DataStoreFactory.create(
        serializer = SessionSerializer { keystoreAead(context) },
        corruptionHandler = ReplaceFileCorruptionHandler { null },
        scope = scope,
        produceFile = { context.dataStoreFile("session.enc") },
    )

    /** Requests ask for the signed-in user's language, which the app shows too. */
    @Provides
    fun requestLanguage(store: SessionStore): RequestLanguage = RequestLanguage { store.language() }

    /** An AES-GCM key kept in shared preferences, itself encrypted by a Keystore master key. */
    private fun keystoreAead(context: Context): Aead {
        AeadConfig.register()
        return AndroidKeysetManager.Builder()
            .withSharedPref(context, "session_keyset", "trackbit_session_keyset")
            .withKeyTemplate(KeyTemplates.get("AES256_GCM"))
            .withMasterKeyUri("android-keystore://trackbit_session_master_key")
            .build()
            .keysetHandle
            .getPrimitive(RegistryConfiguration.get(), Aead::class.java)
    }
}

@Module
@InstallIn(SingletonComponent::class)
internal abstract class AuthBindings {
    @Binds
    abstract fun sessionTokenSource(store: SessionStore): SessionTokenSource

    @Binds
    abstract fun authRepository(repository: DefaultAuthRepository): AuthRepository

    @Binds
    abstract fun accountRepository(repository: DefaultAccountRepository): AccountRepository

    @Binds
    abstract fun preferencesRepository(repository: DefaultPreferencesRepository): PreferencesRepository

    /** Empty until a module contributes one; `core:data` clears the database. */
    @Multibinds
    abstract fun signOutHooks(): Set<SignOutHook>
}
