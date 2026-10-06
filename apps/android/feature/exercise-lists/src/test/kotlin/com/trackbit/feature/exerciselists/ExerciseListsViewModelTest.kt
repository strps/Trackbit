package com.trackbit.feature.exerciselists

import com.trackbit.core.data.ConfigError
import com.trackbit.core.model.EffectiveLimits
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ExerciseListsViewModelTest {
    private val lists = FakeExerciseListsRepository()
    private val library = FakeExerciseLibraryRepository()
    private val dispatcher = StandardTestDispatcher()

    @Before fun setUp() {
        Dispatchers.setMain(dispatcher)
        lists.lists = listOf(exerciseList(1, "Push"), exerciseList(2, "Pull"), exerciseList(3, "Legs", frozen = true))
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun TestScope.screen(): ExerciseListsViewModel {
        val viewModel = ExerciseListsViewModel(lists, library)
        viewModel.refresh()
        advanceUntilIdle()
        return viewModel
    }

    private fun ExerciseListsViewModel.names() = state.value.lists?.map { it.name }

    @Test fun `a drag is sent as the whole order when it ends`() = runTest(dispatcher) {
        val viewModel = screen()
        viewModel.move(listUuid(2), listUuid(1))
        assertEquals(listOf("Pull", "Push", "Legs"), viewModel.names())
        viewModel.drop()
        advanceUntilIdle()

        assertEquals("reorder ${listOf(listUuid(2), listUuid(1), listUuid(3))}", lists.calls.last())
        assertEquals(listOf("Pull", "Push", "Legs"), viewModel.names())
    }

    @Test fun `frozen lists stay at the end`() = runTest(dispatcher) {
        val viewModel = screen()
        viewModel.move(listUuid(3), listUuid(2))
        viewModel.drop()
        advanceUntilIdle()

        assertEquals(listOf("Push", "Pull", "Legs"), viewModel.names())
        assertEquals(ListsMessage.Frozen, viewModel.state.value.message)
        assertTrue(lists.calls.none { it.startsWith("reorder") })
    }

    @Test fun `a refused reorder puts the server's order back`() = runTest(dispatcher) {
        val viewModel = screen()
        viewModel.move(listUuid(2), listUuid(1))
        lists.failWith = ConfigError.Offline
        viewModel.drop()
        advanceUntilIdle()

        assertEquals(listOf("Push", "Pull", "Legs"), viewModel.names())
        assertEquals(ListsMessage.Offline, viewModel.state.value.message)
    }

    @Test fun `creating opens the new list, and a taken name keeps the dialog and its uuid`() = runTest(dispatcher) {
        val viewModel = screen()
        viewModel.startCreate()
        val uuid = checkNotNull(viewModel.state.value.creating!!.newUuid)
        viewModel.editCreate { it.edit(name = "  ") }
        viewModel.create()
        assertTrue(viewModel.state.value.creating!!.showProblems)

        lists.failWith = ConfigError.ExerciseListNameTaken
        viewModel.editCreate { it.edit(name = " Core ") }
        viewModel.create()
        advanceUntilIdle()
        assertTrue(viewModel.state.value.creating!!.nameTaken)
        viewModel.editCreate { it.edit(name = "Core 2") }
        assertEquals(false, viewModel.state.value.creating!!.nameTaken)

        lists.failWith = null
        viewModel.create()
        advanceUntilIdle()
        assertNull(viewModel.state.value.creating)
        assertEquals("the retry names the same list", uuid, viewModel.state.value.created)
        assertEquals("Core 2", viewModel.names()?.last())
    }

    @Test fun `at the cap the add button says why`() = runTest(dispatcher) {
        library.limits = EffectiveLimits(maxHabits = 10, maxCustomExercises = 5, maxExerciseLists = 3, allowedHabitTypes = emptyList())
        val viewModel = screen()
        viewModel.startCreate()

        assertNull(viewModel.state.value.creating)
        assertEquals(ListsMessage.LimitReached(3), viewModel.state.value.message)
    }
}
