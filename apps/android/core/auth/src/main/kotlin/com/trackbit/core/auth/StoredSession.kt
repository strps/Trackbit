package com.trackbit.core.auth

import androidx.datastore.core.CorruptionException
import androidx.datastore.core.Serializer
import com.google.crypto.tink.Aead
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.serialization.TrackbitJson
import kotlinx.serialization.SerializationException
import kotlinx.serialization.Serializable
import java.io.InputStream
import java.io.OutputStream
import java.security.GeneralSecurityException

/** What is kept on disk: the bearer token and the user it belongs to, written together. */
@Serializable
internal data class StoredSession(val token: String, val user: SessionUser)

/**
 * Encrypts the whole session with [aead] (backed by the Android Keystore in the app). An empty
 * file is "signed out". A file that doesn't decrypt, e.g. after the Keystore key was lost, is
 * a [CorruptionException], which the store's corruption handler turns into "signed out".
 */
internal class SessionSerializer(aead: () -> Aead) : Serializer<StoredSession?> {
    private val aead by lazy(aead)

    override val defaultValue: StoredSession? = null

    override suspend fun readFrom(input: InputStream): StoredSession? {
        val bytes = input.readBytes()
        if (bytes.isEmpty()) return null
        return try {
            val plain = aead.decrypt(bytes, ASSOCIATED_DATA).decodeToString()
            TrackbitJson.decodeFromString(StoredSession.serializer(), plain)
        } catch (e: GeneralSecurityException) {
            throw CorruptionException("The stored session doesn't decrypt", e)
        } catch (e: SerializationException) {
            throw CorruptionException("The stored session doesn't decode", e)
        }
    }

    override suspend fun writeTo(t: StoredSession?, output: OutputStream) {
        if (t == null) return
        val plain = TrackbitJson.encodeToString(StoredSession.serializer(), t).encodeToByteArray()
        output.write(aead.encrypt(plain, ASSOCIATED_DATA))
    }

    private companion object {
        val ASSOCIATED_DATA = "trackbit-session-v1".encodeToByteArray()
    }
}
