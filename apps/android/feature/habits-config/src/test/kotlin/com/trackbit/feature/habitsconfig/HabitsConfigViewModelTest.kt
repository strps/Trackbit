package com.trackbit.feature.habitsconfig

import com.trackbit.core.data.ConfigError
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.HabitOrder
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class HabitsConfigViewModelTest {
    private val repository = FakeHabitsRepository()
    private val dispatcher = StandardTestDispatcher()

    @Before fun setUp() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    private fun TestScope.loaded(): HabitsConfigViewModel {
        val viewModel = HabitsConfigViewModel(repository)
        viewModel.refresh()
        advanceUntilIdle()
        return viewModel
    }

    /** Row keys, habits by fixture number: habitUuid(3) is 3. */
    private val HabitsConfigViewModel.keys
        get() = state.value.rows?.map { row -> (row.key as? String)?.removePrefix("habit-")?.toIntOrNull() ?: row.key }

    @Test fun `habits come in order, then the anti-habits header, then anti-habits`() = runTest(dispatcher) {
        repository.habits = listOf(
            habit(1, order = 1),
            habit(2, isAntiHabit = true, order = 0),
            habit(3, order = 0),
        )
        assertEquals(listOf(3, 1, ANTI_HEADER_KEY, 2), loaded().keys)
    }

    @Test fun `at the cap the add button explains instead of opening the form`() = runTest(dispatcher) {
        repository.habits = listOf(habit(1), habit(2, order = 1))
        repository.limits = EffectiveLimits(maxHabits = 2, maxCustomExercises = null, maxExerciseLists = null, allowedHabitTypes = emptyList())
        val viewModel = loaded()
        assertTrue(viewModel.state.value.atHabitCap)

        viewModel.onAddAtCap()
        assertEquals(HabitsConfigMessage.HabitLimitReached(2), viewModel.state.value.message)
    }

    @Test fun `a failed first load offers a retry`() = runTest(dispatcher) {
        repository.failWith = ConfigError.Offline
        val viewModel = loaded()
        assertTrue(viewModel.state.value.loadFailed)
        assertNull(viewModel.state.value.rows)
        assertEquals(HabitsConfigMessage.Offline, viewModel.state.value.message)

        repository.failWith = null
        repository.habits = listOf(habit(1))
        viewModel.refresh()
        advanceUntilIdle()
        assertFalse(viewModel.state.value.loadFailed)
        assertEquals(listOf(1, ANTI_HEADER_KEY), viewModel.keys)
    }

    @Test fun `dragging past the header makes a habit an anti-habit`() = runTest(dispatcher) {
        repository.habits = listOf(habit(1), habit(2, order = 1), habit(3, isAntiHabit = true))
        val viewModel = loaded()

        viewModel.move(from = habitUuid(2), to = ANTI_HEADER_KEY)
        viewModel.drop()
        advanceUntilIdle()

        assertEquals(listOf(1, ANTI_HEADER_KEY, 2, 3), viewModel.keys)
        assertEquals(
            listOf(HabitOrder(habitUuid(1), 0, false), HabitOrder(habitUuid(2), 0, true), HabitOrder(habitUuid(3), 1, true)),
            repository.reorders.single(),
        )
    }

    @Test fun `a drop that changes nothing sends nothing`() = runTest(dispatcher) {
        repository.habits = listOf(habit(1), habit(2, order = 1))
        val viewModel = loaded()

        viewModel.move(from = habitUuid(1), to = habitUuid(2))
        viewModel.move(from = habitUuid(1), to = habitUuid(2))
        viewModel.drop()
        advanceUntilIdle()

        assertEquals(emptyList<List<HabitOrder>>(), repository.reorders)
    }

    @Test fun `a structured session dropped among anti-habits goes back`() = runTest(dispatcher) {
        repository.habits = listOf(habit(1, type = HabitType.Complex), habit(2, isAntiHabit = true))
        val viewModel = loaded()

        viewModel.move(from = habitUuid(1), to = ANTI_HEADER_KEY)
        viewModel.drop()
        advanceUntilIdle()

        assertEquals(listOf(1, ANTI_HEADER_KEY, 2), viewModel.keys)
        assertEquals(HabitsConfigMessage.StructuredAntiHabit, viewModel.state.value.message)
        assertTrue(repository.reorders.isEmpty())
    }

    @Test fun `a frozen habit can shift but not change group`() = runTest(dispatcher) {
        repository.habits = listOf(habit(1, frozen = true), habit(2, order = 1))
        val viewModel = loaded()

        viewModel.move(from = habitUuid(2), to = habitUuid(1))
        viewModel.drop()
        advanceUntilIdle()
        assertEquals(listOf(HabitOrder(habitUuid(2), 0, false), HabitOrder(habitUuid(1), 1, false)), repository.reorders.single())

        // The frozen one ends up below the header when the header passes above it.
        viewModel.move(from = ANTI_HEADER_KEY, to = habitUuid(1))
        viewModel.drop()
        advanceUntilIdle()
        assertEquals(listOf(2, 1, ANTI_HEADER_KEY), viewModel.keys)
        assertEquals(HabitsConfigMessage.HabitFrozen, viewModel.state.value.message)
        assertEquals(1, repository.reorders.size)
    }

    @Test fun `a refused reorder puts the old order back`() = runTest(dispatcher) {
        repository.habits = listOf(habit(1), habit(2, order = 1))
        val viewModel = loaded()

        repository.failWith = ConfigError.Offline
        viewModel.move(from = habitUuid(2), to = habitUuid(1))
        viewModel.drop()
        assertEquals(listOf(2, 1, ANTI_HEADER_KEY), viewModel.keys)
        advanceUntilIdle()

        assertEquals(listOf(1, 2, ANTI_HEADER_KEY), viewModel.keys)
        assertEquals(HabitsConfigMessage.Offline, viewModel.state.value.message)
    }
}
