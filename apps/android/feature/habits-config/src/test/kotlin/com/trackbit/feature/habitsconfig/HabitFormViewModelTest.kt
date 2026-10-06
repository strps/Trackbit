package com.trackbit.feature.habitsconfig

import androidx.lifecycle.SavedStateHandle
import com.trackbit.core.data.ConfigError
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.HabitRules
import com.trackbit.core.model.HabitType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HabitFormViewModelTest {
    private val repository = FakeHabitsRepository()
    private val dispatcher = StandardTestDispatcher()

    @Before fun setUp() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun TestScope.form(habit: Int? = null): HabitFormViewModel {
        val savedState = SavedStateHandle()
        if (habit != null) savedState[HabitFormViewModel.HABIT_UUID] = habitUuid(habit)
        val viewModel = HabitFormViewModel(repository, savedState)
        advanceUntilIdle()
        return viewModel
    }

    @Test fun `problems show only after trying to save, and nothing is sent`() = runTest(dispatcher) {
        val viewModel = form()
        viewModel.edit { it.copy(name = "Go") }
        assertFalse(viewModel.state.value.showProblems)

        viewModel.save()
        advanceUntilIdle()
        assertTrue(viewModel.state.value.showProblems)
        assertEquals(setOf(HabitRules.Problem.NameLength), viewModel.state.value.form.problems)
        assertTrue(repository.created.isEmpty())
    }

    @Test fun `a new habit is created with a trimmed name, then the screen closes`() = runTest(dispatcher) {
        val viewModel = form()
        viewModel.edit { it.copy(name = "  Drink water ", colorTheme = ColorTheme.Rose) }
        viewModel.save()
        advanceUntilIdle()

        val request = repository.created.single()
        assertEquals("Drink water", request.name)
        assertEquals(ColorTheme.Rose, request.colorTheme)
        assertNotNull("a create names its habit", request.uuid)
        assertTrue(viewModel.state.value.done)
    }

    @Test fun `a structured session drops the anti-habit switch`() = runTest(dispatcher) {
        val viewModel = form()
        viewModel.edit { it.copy(name = "Gym", isAntiHabit = true) }
        viewModel.setType(HabitType.Complex)
        viewModel.save()
        advanceUntilIdle()

        assertFalse(repository.created.single().isAntiHabit)
    }

    @Test fun `changing type keeps the daily goal in the new type's range`() = runTest(dispatcher) {
        val viewModel = form()
        viewModel.setType(HabitType.Timed)
        viewModel.edit { it.copy(dailyGoal = 600) }
        viewModel.setType(HabitType.Count)
        assertEquals(100, viewModel.state.value.form.dailyGoal)
    }

    @Test fun `editing loads the habit and saves it by id`() = runTest(dispatcher) {
        repository.habits = listOf(habit(7, name = "Read", type = HabitType.Timed, dailyGoal = 45))
        val viewModel = form(habit = 7)
        assertEquals("Read", viewModel.state.value.form.name)
        assertEquals(45, viewModel.state.value.form.dailyGoal)

        viewModel.edit { it.copy(name = "Read more") }
        viewModel.save()
        advanceUntilIdle()
        assertEquals(habitUuid(7) to "Read more", repository.updated.single().let { (uuid, request) -> uuid to request.name })
    }

    @Test fun `a frozen habit can't be saved but can be deleted`() = runTest(dispatcher) {
        repository.habits = listOf(habit(7, frozen = true))
        val viewModel = form(habit = 7)
        assertFalse(viewModel.state.value.canSave)

        viewModel.save()
        viewModel.delete()
        advanceUntilIdle()
        assertTrue(repository.updated.isEmpty())
        assertEquals(listOf(habitUuid(7)), repository.deleted)
        assertTrue(viewModel.state.value.done)
    }

    @Test fun `an edit opened offline, before Room holds the habits, says so`() = runTest(dispatcher) {
        repository.habits = listOf(habit(7))
        repository.failWith = ConfigError.Offline
        val viewModel = form(habit = 7)
        assertTrue(viewModel.state.value.loadFailed)
        assertEquals(HabitFormMessage.Offline, viewModel.state.value.message)

        repository.failWith = null
        viewModel.load()
        advanceUntilIdle()
        assertFalse(viewModel.state.value.loadFailed)
    }

    @Test fun `an edit reads Room without pulling, and a pull meanwhile doesn't undo it`() = runTest(dispatcher) {
        repository.habits = listOf(habit(7, name = "Read"))
        repository.refresh()
        repository.failWith = ConfigError.Offline
        val viewModel = form(habit = 7)
        assertEquals("Read", viewModel.state.value.form.name)

        viewModel.edit { it.copy(name = "Read more") }
        repository.failWith = null
        repository.habits = listOf(habit(7, name = "Renamed on the web"))
        repository.refresh()
        advanceUntilIdle()
        assertEquals("Read more", viewModel.state.value.form.name)
    }

    @Test fun `a habit deleted elsewhere can't be edited`() = runTest(dispatcher) {
        val viewModel = form(habit = 7)
        assertTrue(viewModel.state.value.loadFailed)
        assertEquals(HabitFormMessage.NotFound, viewModel.state.value.message)
    }

    @Test fun `the role's types come from the limits, and a refusal says why`() = runTest(dispatcher) {
        repository.limits = EffectiveLimits(
            maxHabits = 10, maxCustomExercises = null, maxExerciseLists = null,
            allowedHabitTypes = listOf(HabitType.Count, HabitType.Complex),
        )
        repository.refresh() // The list the form opens from has pulled them into Room.
        val viewModel = form()
        assertFalse(viewModel.state.value.allows(HabitType.Timed))
        assertTrue(viewModel.state.value.allows(HabitType.Complex))

        repository.failWith = ConfigError.HabitLimitReached(10)
        viewModel.edit { it.copy(name = "Read") }
        viewModel.save()
        advanceUntilIdle()
        assertEquals(HabitFormMessage.HabitLimitReached(10), viewModel.state.value.message)
        assertFalse(viewModel.state.value.done)
        assertFalse(viewModel.state.value.busy)
    }
}
