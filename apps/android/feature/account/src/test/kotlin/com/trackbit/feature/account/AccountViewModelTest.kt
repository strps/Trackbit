package com.trackbit.feature.account

import com.trackbit.core.auth.AccountRepository
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.auth.PreferencesRepository
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.network.ApiError
import com.trackbit.core.network.ApiResult
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import kotlinx.coroutines.yield
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

@OptIn(ExperimentalCoroutinesApi::class)
class AccountViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val auth = FakeAuth()
    private val account = FakeAccount(auth)
    private val preferences = FakePreferences(auth)
    private val viewModel by lazy { AccountViewModel(auth, account, preferences) }

    /** The screen collects the state; without a collector it stays the initial value. */
    private fun TestScope.subscribed(): AccountViewModel {
        backgroundScope.launch(UnconfinedTestDispatcher(testScheduler)) { viewModel.state.collect {} }
        return viewModel
    }

    @Before fun setUp() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    @Test fun `the name saves only when changed and valid, and the field then shows the stored one`() = runTest(dispatcher) {
        val viewModel = subscribed()
        assertFalse(viewModel.state.value.canSaveName)
        viewModel.editName("   ")
        advanceUntilIdle()
        assertFalse(viewModel.state.value.nameValid)
        viewModel.saveName()
        advanceUntilIdle()
        assertTrue(account.names.isEmpty())

        viewModel.editName(" Ada ")
        viewModel.saveName()
        advanceUntilIdle()
        assertEquals(listOf(" Ada "), account.names)
        val state = viewModel.state.value
        assertNull(state.name)
        assertEquals("Ada", state.shownName)
        assertEquals(AccountMessage.ProfileUpdated, state.message)
    }

    @Test fun `password problems show only after submitting, and nothing is sent`() = runTest(dispatcher) {
        val viewModel = subscribed()
        viewModel.editPassword { it.copy(current = "old-password", new = "short", confirm = "other") }
        advanceUntilIdle()
        assertFalse(viewModel.state.value.password.showProblems)
        viewModel.changePassword()
        advanceUntilIdle()
        val form = viewModel.state.value.password
        assertTrue(form.showProblems && form.tooShort && form.mismatch)
        assertTrue(account.passwords.isEmpty())
    }

    @Test fun `a changed password clears the form, a wrong current one says so and keeps it`() = runTest(dispatcher) {
        val viewModel = subscribed()
        account.passwordResult = ApiResult.Failure(ApiError.Validation("Invalid password", emptyList(), "INVALID_PASSWORD"))
        viewModel.editPassword { it.copy(current = "wrong", new = "password-5678", confirm = "password-5678") }
        viewModel.changePassword()
        advanceUntilIdle()
        assertEquals(AccountMessage.InvalidPassword, viewModel.state.value.message)
        assertEquals("wrong", viewModel.state.value.password.current)

        account.passwordResult = ApiResult.Success(Unit)
        viewModel.changePassword()
        advanceUntilIdle()
        assertEquals(listOf("wrong" to "password-5678", "wrong" to "password-5678"), account.passwords)
        assertEquals(PasswordForm(), viewModel.state.value.password)
        assertEquals(AccountMessage.PasswordChanged, viewModel.state.value.message)
    }

    @Test fun `errors map to messages`() {
        assertEquals(AccountMessage.Offline, ApiError.Network(IOException()).toMessage())
        assertEquals(AccountMessage.InvalidPassword, ApiError.Validation("x", emptyList(), "INVALID_PASSWORD").toMessage())
        assertEquals(AccountMessage.Failed, ApiError.Validation("x", emptyList(), "INVALID_NAME").toMessage())
        assertEquals(AccountMessage.Failed, ApiError.Server(500, null).toMessage())
    }

    @Test fun `preferences go to the repository and show from the session`() = runTest(dispatcher) {
        val viewModel = subscribed()
        viewModel.setLocale("en")
        viewModel.setUnitSystem(UnitSystem.Imperial)
        viewModel.setCardStyle(ExerciseLogCardStyle.Classic)
        viewModel.setDefaultRest(9999)
        advanceUntilIdle()
        val user = (auth.state.value as AuthState.SignedIn).user
        assertEquals(listOf("en", UnitSystem.Imperial, ExerciseLogCardStyle.Classic, SessionUser.REST_SECONDS_RANGE.last), preferences.set)
        assertEquals("en", user.locale)
    }
}

private val USER = SessionUser(
    id = "u_1", name = "cj", email = "cj@test.local", emailVerified = true, image = null, role = "tester",
    locale = "es", timezone = "America/Costa_Rica", unitSystem = UnitSystem.Metric,
    exerciseLogCardStyle = ExerciseLogCardStyle.Compact, preferredExerciseSource = null,
)

private class FakeAuth : AuthRepository {
    override val state = MutableStateFlow<AuthState>(AuthState.SignedIn(USER))
    override suspend fun signIn(email: String, password: String) = error("unused")
    override suspend fun signOut() = error("unused")
    override suspend fun refresh() = error("unused")

    fun change(change: (SessionUser) -> SessionUser) {
        state.value = AuthState.SignedIn(change((state.value as AuthState.SignedIn).user))
    }
}

/** Caches the new name, as the real one does. */
private class FakeAccount(private val auth: FakeAuth) : AccountRepository {
    val names = mutableListOf<String>()
    val passwords = mutableListOf<Pair<String, String>>()
    var passwordResult: ApiResult<Unit> = ApiResult.Success(Unit)

    override suspend fun updateName(name: String): ApiResult<Unit> {
        yield()
        names += name
        auth.change { it.copy(name = name.trim()) }
        return ApiResult.Success(Unit)
    }

    override suspend fun changePassword(currentPassword: String, newPassword: String): ApiResult<Unit> {
        yield()
        passwords += currentPassword to newPassword
        return passwordResult
    }
}

/** Changes the cached user, as the real one does. */
private class FakePreferences(private val auth: FakeAuth) : PreferencesRepository {
    val set = mutableListOf<Any?>()

    private suspend fun record(value: Any?, change: (SessionUser) -> SessionUser) {
        yield()
        set += value
        auth.change(change)
    }

    override suspend fun setPreferredExerciseSource(key: String?) = record(key) { it.copy(preferredExerciseSource = key) }
    override suspend fun setDefaultRestSeconds(seconds: Int) = record(seconds) { it.copy(defaultRestSeconds = seconds) }
    override suspend fun setLocale(locale: String) = record(locale) { it.copy(locale = locale) }
    override suspend fun setUnitSystem(unitSystem: UnitSystem) = record(unitSystem) { it.copy(unitSystem = unitSystem) }
    override suspend fun setExerciseLogCardStyle(style: ExerciseLogCardStyle) = record(style) { it.copy(exerciseLogCardStyle = style) }
    override suspend fun setTimezone(zone: String) = record(zone) { it.copy(timezone = zone) }
}
