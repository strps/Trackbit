package com.trackbit.feature.exerciselibrary

import com.trackbit.core.data.ConfigError
import com.trackbit.core.designsystem.component.ListTarget
import com.trackbit.core.designsystem.component.ListTargets
import com.trackbit.core.model.EffectiveLimits
import com.trackbit.core.model.MuscleGroupRef
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
class ExerciseLibraryViewModelTest {
    private val repository = FakeExerciseLibraryRepository()
    private val lists = FakeExerciseListsRepository()
    private val dispatcher = StandardTestDispatcher()

    private val chest = MuscleGroupRef(1, "Chest")
    private val upperChest = MuscleGroupRef(3, "Upper chest")
    private val back = MuscleGroupRef(2, "Back")

    @Before fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository.muscleGroups = listOf(group(2, "Back"), group(1, "Chest"), group(3, "Upper chest", parentId = 1))
        repository.exercises = listOf(
            exercise(1, "Row", muscles = listOf(back)),
            exercise(2, "bench press", muscles = listOf(chest)),
            exercise(3, "Incline press", mine = true, muscles = listOf(upperChest)),
            exercise(4, "Plank", mine = true),
        )
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun TestScope.library(): ExerciseLibraryViewModel {
        val viewModel = ExerciseLibraryViewModel(repository, lists)
        viewModel.refresh()
        advanceUntilIdle()
        return viewModel
    }

    private fun ExerciseLibraryViewModel.names() = state.value.visible.map { it.name }

    @Test fun `exercises are sorted by name and searched case-insensitively`() = runTest(dispatcher) {
        val viewModel = library()
        assertEquals(listOf("bench press", "Incline press", "Plank", "Row"), viewModel.names())

        viewModel.search(" PRESS ")
        assertEquals(listOf("bench press", "Incline press"), viewModel.names())
    }

    @Test fun `the owner filter splits custom and system exercises`() = runTest(dispatcher) {
        val viewModel = library()
        viewModel.filterOwner(OwnerFilter.Custom)
        assertEquals(listOf("Incline press", "Plank"), viewModel.names())
        viewModel.filterOwner(OwnerFilter.System)
        assertEquals(listOf("bench press", "Row"), viewModel.names())
    }

    @Test fun `a muscle filter offers top-level groups and matches their subdivisions`() = runTest(dispatcher) {
        val viewModel = library()
        assertEquals(listOf("Chest", "Back"), viewModel.state.value.filterGroups.map { it.name })

        viewModel.filterMuscleGroup(1)
        assertEquals(listOf("bench press", "Incline press"), viewModel.names())
    }

    @Test fun `a filter on a group that's gone is dropped on refresh`() = runTest(dispatcher) {
        val viewModel = library()
        viewModel.filterMuscleGroup(2)
        repository.muscleGroups = listOf(group(1, "Chest"))

        viewModel.refresh()
        advanceUntilIdle()
        assertNull(viewModel.state.value.muscleGroupId)
    }

    @Test fun `at the cap, adding explains why instead of opening the form`() = runTest(dispatcher) {
        repository.limits = EffectiveLimits(maxHabits = null, maxCustomExercises = 2, maxExerciseLists = null, allowedHabitTypes = emptyList())
        val viewModel = library()
        assertTrue(viewModel.state.value.atExerciseCap)

        viewModel.onAddAtCap()
        assertEquals(ExerciseLibraryMessage.LimitReached(2), viewModel.state.value.message)
    }

    @Test fun `offline at first shows a retry, offline later keeps the list`() = runTest(dispatcher) {
        repository.failWith = ConfigError.Offline
        val viewModel = library()
        assertTrue(viewModel.state.value.loadFailed)

        repository.failWith = null
        viewModel.refresh()
        advanceUntilIdle()
        assertFalse(viewModel.state.value.loadFailed)

        repository.failWith = ConfigError.Offline
        viewModel.refresh()
        advanceUntilIdle()
        assertFalse(viewModel.state.value.loadFailed)
        assertEquals(4, viewModel.state.value.exercises?.size)
        assertEquals(ExerciseLibraryMessage.Offline, viewModel.state.value.message)
    }

    @Test fun `add to list appends to an unfrozen list and says so`() = runTest(dispatcher) {
        lists.lists = listOf(exerciseList(1, "Push"), exerciseList(2, "Frozen", frozen = true))
        val viewModel = library()
        assertEquals(ListTargets.Loaded(listOf(ListTarget(listUuid(1), "Push", 0, contains = false))), viewModel.state.value.listTargets(exerciseUuid(2)))

        viewModel.addToList(listUuid(1), exerciseUuid(2))
        advanceUntilIdle()

        assertEquals(listOf("lists", "append ${listUuid(1)} ${exerciseUuid(2)}"), lists.calls)
        assertEquals(ExerciseLibraryMessage.AddedToList("Push"), viewModel.state.value.message)
        assertEquals(ListTargets.Loaded(listOf(ListTarget(listUuid(1), "Push", 1, contains = true))), viewModel.state.value.listTargets(exerciseUuid(2)))
    }

    @Test fun `lists that failed to load are retried when the menu opens`() = runTest(dispatcher) {
        lists.failWith = ConfigError.Offline
        val viewModel = library()
        assertEquals(ListTargets.Offline, viewModel.state.value.listTargets(exerciseUuid(2)))

        lists.failWith = null
        viewModel.onListsMenu()
        advanceUntilIdle()
        assertEquals(ListTargets.Loaded(emptyList()), viewModel.state.value.listTargets(exerciseUuid(2)))
    }
}
