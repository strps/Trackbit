package com.trackbit.core.auth

import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.UnitSystem
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
import java.time.ZoneId
import java.util.Locale
import java.util.concurrent.TimeUnit

/** The repository against a fake server, with the store as the client's token source. */
class AuthRepositoryTest {
    @get:Rule val folder = TemporaryFolder()

    private val server = MockWebServer().apply { start() }
    private val harness by lazy { StoreHarness(folder.root.resolve("session.enc")) }
    // Wired as in the app: the store gives both the token and the request language.
    private val retrofit by lazy {
        trackbitRetrofit(server.url("/").toString(), trackbitOkHttpClient(harness.store) { harness.store.language() })
    }
    private val repository by lazy { DefaultAuthRepository(harness.store, retrofit.create<AuthService>(), harness.scope) }
    private val preferences by lazy { DefaultPreferencesRepository(harness.store, retrofit.create<MeService>(), harness.scope) }
    private val account by lazy { DefaultAccountRepository(harness.store, retrofit.create<AuthService>()) }

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

    @Test fun `locale, units, card style and timezone change the cached user at once and are PATCHed`() = runTest {
        signIn()
        val changes = listOf(
            suspend { preferences.setLocale("en") } to """{"locale":"en"}""",
            suspend { preferences.setUnitSystem(UnitSystem.Imperial) } to """{"unitSystem":"imperial"}""",
            suspend { preferences.setExerciseLogCardStyle(ExerciseLogCardStyle.Classic) } to """{"exerciseLogCardStyle":"classic"}""",
            suspend { preferences.setTimezone("Europe/Madrid") } to """{"timezone":"Europe/Madrid"}""",
        )
        for ((change, body) in changes) {
            enqueue(204)
            change()
            assertEquals(body, take().body?.utf8())
        }
        val expected = user().copy(
            locale = "en", unitSystem = UnitSystem.Imperial, exerciseLogCardStyle = ExerciseLogCardStyle.Classic, timezone = "Europe/Madrid",
        )
        assertEquals(AuthState.SignedIn(expected), repository.state.value)
        assertThrows(IllegalArgumentException::class.java) { runBlocking { preferences.setLocale("fr") } }
    }

    @Test fun `requests ask for the signed-in user's language, which follows a change at once`() = runTest {
        signIn()
        enqueue(200, "[]")
        safeCall { retrofit.create<HabitsService>().habits() }
        assertEquals("es", take().headers["Accept-Language"])

        enqueue(204)
        preferences.setLocale("en")
        // The PATCH itself already goes out in the new language.
        assertEquals("en", take().headers["Accept-Language"])
    }

    @Test fun `a new name is trimmed, sent, and cached once the server accepts it`() = runTest {
        signIn()
        enqueue(200, """{"status":true}""")
        assertEquals(ApiResult.Success(Unit), account.updateName("  Ada  "))
        assertEquals("""{"name":"Ada"}""", take().body?.utf8())
        assertEquals(AuthState.SignedIn(user(name = "Ada")), repository.state.value)

        enqueue(400, """{"code":"INVALID_NAME","message":"Invalid name"}""")
        assertEquals(ApiResult.Failure(ApiError.Validation("Invalid name", emptyList(), "INVALID_NAME")), account.updateName("Bo"))
        take()
        assertEquals(AuthState.SignedIn(user(name = "Ada")), repository.state.value)
        assertThrows(IllegalArgumentException::class.java) { runBlocking { account.updateName("   ") } }
    }

    @Test fun `a password change revokes other sessions and adopts the new token`() = runTest {
        signIn("old.sig")
        val signOutsBefore = harness.signOuts.size
        enqueue(200, """{"token":"raw","user":{}}""", "set-auth-token" to "new.sig")

        assertEquals(ApiResult.Success(Unit), account.changePassword("password-1234", "password-5678"))
        val request = take()
        assertEquals("Bearer old.sig", request.headers["Authorization"])
        assertEquals(
            """{"currentPassword":"password-1234","newPassword":"password-5678","revokeOtherSessions":true}""",
            request.body?.utf8(),
        )
        assertEquals("new.sig", harness.store.currentToken())
        assertEquals(AuthState.SignedIn(user()), repository.state.value)
        assertEquals(signOutsBefore, harness.signOuts.size) // Room was not cleared
    }

    @Test fun `the old token's 401s during a password change don't sign out`() = runTest {
        signIn("old.sig")
        val signOutsBefore = harness.signOuts.size
        harness.store.rotate(ifToken = "old.sig") {
            harness.store.onUnauthorized("old.sig") // a concurrent request, sent before the change
            ApiResult.Success("new.sig")
        }
        harness.store.onUnauthorized("old.sig") // one that arrives after: the token is no longer current
        harness.settled()
        assertEquals("new.sig", harness.store.token())
        assertEquals(AuthState.SignedIn(user()), repository.state.value)
        assertEquals(signOutsBefore, harness.signOuts.size)
    }

    @Test fun `a wrong current password keeps the session, a lost one signs out`() = runTest {
        signIn("old.sig")
        enqueue(400, """{"code":"INVALID_PASSWORD","message":"Invalid password"}""")
        assertEquals(
            ApiResult.Failure(ApiError.Validation("Invalid password", emptyList(), "INVALID_PASSWORD")),
            account.changePassword("wrong-pass", "password-5678"),
        )
        take()
        assertEquals("old.sig", harness.store.token())

        enqueue(401, """{"code":"UNAUTHORIZED","message":"Unauthorized"}""")
        account.changePassword("password-1234", "password-5678")
        take()
        assertEquals(AuthState.SignedOut, repository.state.value)
    }

    private fun sessionJson(name: String = "cj") = """
        {"session":{"id":"s_1","userId":"u_1","expiresAt":"2026-10-03T09:00:00.000Z","token":"raw"},
         "user":{"id":"u_1","name":"$name","email":"u_1@test.local","emailVerified":true,"image":null,
                 "role":"tester","locale":"es","timezone":"America/Costa_Rica","unitSystem":"metric",
                 "exerciseLogCardStyle":"compact","preferredExerciseSource":null}}
    """.trimIndent()

    @Test fun `sign-up sends the app's language and the device's zone, and starts no session`() = runTest {
        harness.settled()
        val default = Locale.getDefault()
        Locale.setDefault(Locale.forLanguageTag("es-CR"))
        try {
            enqueue(200, """{"token":null,"user":{}}""")
            assertEquals(ApiResult.Success(Unit), repository.signUp("Ada", "ada@test.local", "password-1", " CODE "))
            val request = take()
            assertEquals("/api/auth/sign-up/email", request.target)
            assertEquals(
                """{"name":"Ada","email":"ada@test.local","password":"password-1","locale":"es",""" +
                    """"timezone":"${ZoneId.systemDefault().id}","inviteCode":"CODE"}""",
                request.body?.utf8(),
            )
            assertNull(request.headers["Authorization"])

            // A language the apps don't ship falls back to English; a blank invite is left out.
            Locale.setDefault(Locale.forLanguageTag("fr-FR"))
            enqueue(200, """{"token":null,"user":{}}""")
            repository.signUp("Ada", "ada@test.local", "password-1", "  ")
            assertEquals(
                """{"name":"Ada","email":"ada@test.local","password":"password-1","locale":"en",""" +
                    """"timezone":"${ZoneId.systemDefault().id}"}""",
                take().body?.utf8(),
            )
        } finally {
            Locale.setDefault(default)
        }
        assertEquals(AuthState.SignedOut, repository.state.value)
    }

    @Test fun `reset and resend requests carry only the email`() = runTest {
        harness.settled()
        enqueue(200, """{"status":true,"message":"If this email exists in our system, check your email for the reset link"}""")
        assertEquals(ApiResult.Success(Unit), repository.requestPasswordReset("ada@test.local"))
        take().let {
            assertEquals("/api/auth/request-password-reset", it.target)
            assertEquals("""{"email":"ada@test.local"}""", it.body?.utf8())
        }
        enqueue(200, """{"status":true}""")
        assertEquals(ApiResult.Success(Unit), repository.resendVerificationEmail("ada@test.local"))
        take().let {
            assertEquals("/api/auth/send-verification-email", it.target)
            assertEquals("""{"email":"ada@test.local"}""", it.body?.utf8())
        }
    }
}
