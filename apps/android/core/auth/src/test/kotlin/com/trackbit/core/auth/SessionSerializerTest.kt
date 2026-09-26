package com.trackbit.core.auth

import androidx.datastore.core.CorruptionException
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream

class SessionSerializerTest {
    private val aead = testAead()
    private val serializer = SessionSerializer { aead }
    private val session = StoredSession("raw.signature", user())

    private suspend fun write(value: StoredSession?, with: SessionSerializer = serializer): ByteArray =
        ByteArrayOutputStream().also { with.writeTo(value, it) }.toByteArray()

    private suspend fun read(bytes: ByteArray, with: SessionSerializer = serializer) =
        with.readFrom(ByteArrayInputStream(bytes))

    @Test fun `round-trips the token and user`() = runTest {
        assertEquals(session, read(write(session)))
    }

    @Test fun `the token is not stored in the clear`() = runTest {
        val bytes = write(session).decodeToString(throwOnInvalidSequence = false)
        assertFalse(bytes.contains("raw.signature"))
        assertFalse(bytes.contains("u_1@test.local"))
    }

    @Test fun `signed out is an empty file`() = runTest {
        assertEquals(0, write(null).size)
        assertNull(read(ByteArray(0)))
    }

    @Test fun `a file from another key is corruption`() = runTest {
        val other = SessionSerializer { testAead() }
        assertThrows(CorruptionException::class.java) { kotlinx.coroutines.runBlocking { read(write(session), other) } }
    }
}
