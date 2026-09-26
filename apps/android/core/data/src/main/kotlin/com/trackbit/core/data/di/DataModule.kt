package com.trackbit.core.data.di

import com.trackbit.core.auth.SignOutHook
import com.trackbit.core.data.ClearDatabaseOnSignOut
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import dagger.multibindings.IntoSet

@Module
@InstallIn(SingletonComponent::class)
internal abstract class DataModule {
    @Binds
    @IntoSet
    abstract fun clearDatabaseOnSignOut(hook: ClearDatabaseOnSignOut): SignOutHook
}
