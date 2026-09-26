package com.trackbit.core.network

import com.trackbit.core.network.service.AuthService
import com.trackbit.core.network.service.session
import com.trackbit.core.network.service.signIn
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AuthServiceTest {
    private val server = TestServer()
    private val auth = server.service<AuthService>()

    @After fun tearDown() = server.close()

    @Test fun `sign-in returns the set-auth-token header, not the body token`() = runTest {
        server.enqueue(200, """{"redirect":false,"token":"raw","user":{}}""", "set-auth-token" to "raw.signature")
        assertEquals(ApiResult.Success("raw.signature"), auth.signIn("a@b.c", "pw"))
        assertEquals("""{"email":"a@b.c","password":"pw"}""", server.takeRequest().body!!.utf8())
    }

    @Test fun `sign-in without the header is a failure`() = runTest {
        server.enqueue(200, """{"redirect":false,"token":"raw"}""")
        val error = (auth.signIn("a@b.c", "pw") as ApiResult.Failure).error
        assertTrue(error is ApiError.Unknown && error.status == 200)
    }

    @Test fun `decodes a session with its preferences`() = runTest {
        server.enqueue(200, SESSION_JSON)
        val session = (auth.session() as ApiResult.Success).value!!
        assertEquals("America/Costa_Rica", session.user.timezone)
    }

    private companion object {
        val SESSION_JSON = """
            {"session":{"id":"s_1","userId":"u_1","expiresAt":"2026-10-03T09:00:00.000Z","token":"tok"},
             "user":{"id":"u_1","name":"cj","email":"cj@test.local","emailVerified":true,"image":null,
                     "role":"tester","locale":"es","timezone":"America/Costa_Rica","unitSystem":"imperial",
                     "exerciseLogCardStyle":"compact","preferredExerciseSource":null}}
        """.trimIndent()
    }
}
