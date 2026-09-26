package com.trackbit.core.auth

import androidx.datastore.core.DataStore
import androidx.datastore.core.DataStoreFactory
import androidx.datastore.core.handlers.ReplaceFileCorruptionHandler
import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.KeysetHandle
import com.google.crypto.tink.RegistryConfiguration
import com.google.crypto.tink.aead.AeadConfig
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.UnitSystem
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import java.io.File

/** An in-memory AES-GCM key, standing in for the Keystore-backed one. */
fun testAead(): Aead {
    AeadConfig.register()
    return KeysetHandle.generateNew(KeyTemplates.get("AES256_GCM"))
        .getPrimitive(RegistryConfiguration.get(), Aead::class.java)
}

fun user(id: String = "u_1", name: String = "cj") = SessionUser(
    id = id,
    name = name,
    email = "$id@test.local",
    emailVerified = true,
    image = null,
    role = "tester",
    locale = "es",
    timezone = "America/Costa_Rica",
    unitSystem = UnitSystem.Metric,
    exerciseLogCardStyle = ExerciseLogCardStyle.Compact,
    preferredExerciseSource = null,
)

/** A [SessionStore] over a real encrypted file, wired as in the app. */
class StoreHarness(private val file: File, private val aead: Aead = testAead()) : AutoCloseable {
    val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val signOuts = mutableListOf<Unit>()
    private val hook = SignOutHook { synchronized(signOuts) { signOuts += Unit } }

    internal val dataStore: DataStore<StoredSession?> = DataStoreFactory.create(
        serializer = SessionSerializer { aead },
        corruptionHandler = ReplaceFileCorruptionHandler { null },
        scope = scope,
        produceFile = { file },
    )
    internal val store = SessionStore(dataStore, setOf(hook), scope)

    suspend fun settled(): AuthState = store.state.first { it != AuthState.Loading }

    override fun close() = scope.cancel()
}
