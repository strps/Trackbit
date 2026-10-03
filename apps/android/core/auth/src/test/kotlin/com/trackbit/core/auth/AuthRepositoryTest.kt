package com.trackbit.core.auth

import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import com.trackbit.core.network.service.AuthService
import com.trackbit.core.network.service.HabitsService
import com.trackbit.core.network.service.MeService
import com.trackbit.core.network.safeCall
import com.trackbit.core.network.trackbitOkHttpClient
import com.trackbit.core.network.trackbitRetrofit
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.test.runTest
import mockwebserver3.MockResponse
import mockwebserver3.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import retrofit2.create
import java.util.concurrent.TimeUnit

/** The repository against a fake server, with the store as the client's token source. */
class AuthRepositoryTest {
    @get:Rule val folder = TemporaryFolder()

    private val server = MockWebServer().apply { start() }
    private val harness by lazy { StoreHarness(folder.root.resolve("session.enc")) }
    private val retrofit by lazy { trackbitRetrofit(server.url("/").toString(), trackbitOkHttpClient(harness.store)) }
    private val repository by lazy { DefaultAuthRepository(harness.store, retrofit.create<AuthService>(), harness.scope) }
    private val preferences by lazy { DefaultPreferencesRepository(harness.store, retrofit.create<MeService>(), harness.scope) }

    @After fun tearDown() {
        harness.close()
        server.close()
    }

    private fun enqueue(code: Int, body: String = "", vararg headers: Pair<String, String>) {
        val builder = MockResponse.Builder().code(code).body(body)
        if (body.isNotEmpty()) builder.addHeader("Content-Type", "application/json")
        headers.forEach { (name, value) -> builder.addHeader(name, value) }
        server.enqueue(builder.build())
    }

    private fun take() = server.takeRequest(5, TimeUnit.SECONDS)!!

    private suspend fun signIn(token: String = "tok.sig"): ApiResult<*> {
        enqueue(200, """{"token":"raw"}""", "set-auth-token" to token)
        enqueue(200, sessionJson())
        return repository.signIn("u_1@test.local", "pw").also { take(); take() }
    }

    @Test fun `sign-in confirms the new token, then stores it with the user`() = runTest {
        harness.settled()
        enqueue(200, """{"token":"raw"}""", "set-auth-token" to "tok.sig")
        enqueue(200, sessionJson())

        assertEquals(ApiResult.Success(user()), repository.signIn("u_1@test.local", "pw"))
        assertNull(take().headers["Authorization"])
        assertEquals("Bearer tok.sig", take().headers["Authorization"])
        assertEquals(AuthState.SignedIn(user()), repository.state.value)
        assertEquals("tok.sig", harness.store.currentToken())
    }

    @Test fun `wrong credentials leave the app signed out`() = runTest {
        harness.settled()
        enqueue(401, """{"code":"INVALID_EMAIL_OR_PASSWORD","message":"Invalid email or password"}""")

        val result = repository.signIn("u_1@test.local", "nope")
        assertEquals(ApiResult.Failure(ApiError.Unauthorized("INVALID_EMAIL_OR_PASSWORD", "Invalid email or password")), result)
        assertEquals(AuthState.SignedOut, repository.state.value)
    }

    @Test fun `a token get-session rejects is not adopted`() = runTest {
        harness.settled()
        enqueue(200, """{"token":"raw"}""", "set-auth-token" to "tok.sig")
        enqueue(200, "null")

        assertTrue(repository.signIn("u_1@test.local", "pw") is ApiResult.Failure)
        assertNull(harness.store.currentToken())
    }

    @Test fun `requests carry the stored token and a 401 signs out`() = runTest {
        harness.settled()
        signIn()
        enqueue(401, """{"error":"Unauthorized"}""")

        safeCall { retrofit.create<HabitsService>().habits() }
        assertEquals("Bearer tok.sig", take().headers["Authorization"])
        assertEquals(AuthState.SignedOut, repository.state.first { it == AuthState.SignedOut })
        assertEquals(2, harness.signOuts.size)
    }

    @Test fun `sign-out clears at once and revokes the old token`() = runTest {
        harness.settled()
        signIn()
        enqueue(200, """{"success":true}""")

        repository.signOut()
        assertEquals(AuthState.SignedOut, repository.state.value)
        assertNull(harness.store.currentToken())
        val revoke = take()
        assertEquals("/api/auth/sign-out", revoke.target)
        assertEquals("Bearer tok.sig", revoke.headers["Authorization"])
    }

    @Test fun `refresh updates the cached user`() = runTest {
        harness.settled()
        signIn()
        enqueue(200, sessionJson(name = "renamed"))

        repository.refresh()
        assertEquals(AuthState.SignedIn(user(name = "renamed")), repository.state.value)
    }

    @Test fun `refresh signs out when the server no longer knows the session`() = runTest {
        harness.settled()
        signIn()
        enqueue(200, "null")

        repository.refresh()
        assertEquals(AuthState.SignedOut, repository.state.value)
    }

    @Test fun `refresh offline keeps the cached session`() = runTest {
        harness.settled()
        signIn()
        server.close()

        repository.refresh()
        assertEquals(AuthState.SignedIn(user()), repository.state.value)
        assertEquals("tok.sig", harness.store.currentToken())
    }

    @Test fun `a preferred source shows in the cached user at once, then reaches the server`() = runTest {
        harness.settled()
        signIn()
        enqueue(204)

        preferences.setPreferredExerciseSource("list:3")
        assertEquals(AuthState.SignedIn(user().copy(preferredExerciseSource = "list:3")), repository.state.value)
        val patch = take()
        assertEquals("PATCH", patch.method)
        assertEquals("/api/me/preferences", patch.target)
        assertEquals("""{"preferredExerciseSource":"list:3"}""", patch.body?.utf8())

        enqueue(204)
        preferences.setPreferredExerciseSource(null)
        assertEquals("""{"preferredExerciseSource":null}""", take().body?.utf8())
        assertEquals(AuthState.SignedIn(user()), repository.state.value)
    }

    @Test fun `the default rest changes the cached user at once and is PATCHed`() = runTest {
        signIn()
        enqueue(204)

        preferences.setDefaultRestSeconds(150)
        assertEquals(AuthState.SignedIn(user().copy(defaultRestSeconds = 150)), repository.state.value)
        assertEquals("""{"defaultRestSeconds":150}""", take().body?.utf8())
        assertThrows(IllegalArgumentException::class.java) { runBlocking { preferences.setDefaultRestSeconds(3601) } }
        assertEquals(150, (repository.state.value as AuthState.SignedIn).user.defaultRestSeconds)
    }

    @Test fun `a preferred source while signed out changes nothing`() = runTest {
        harness.settled()
        preferences.setPreferredExerciseSource("list:3")
        assertEquals(AuthState.SignedOut, repository.state.value)
        assertEquals(0, server.requestCount)
    }

    private fun sessionJson(name: String = "cj") = """
        {"session":{"id":"s_1","userId":"u_1","expiresAt":"2026-10-03T09:00:00.000Z","token":"raw"},
         "user":{"id":"u_1","name":"$name","email":"u_1@test.local","emailVerified":true,"image":null,
                 "role":"tester","locale":"es","timezone":"America/Costa_Rica","unitSystem":"metric",
                 "exerciseLogCardStyle":"compact","preferredExerciseSource":null}}
    """.trimIndent()
}
