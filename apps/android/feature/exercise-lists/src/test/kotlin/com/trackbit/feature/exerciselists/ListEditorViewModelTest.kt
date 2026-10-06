package com.trackbit.feature.exerciselists

import androidx.lifecycle.SavedStateHandle
import com.trackbit.core.data.ConfigError
import com.trackbit.core.model.Prescription
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.model.prescription
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ListEditorViewModelTest {
    private val lists = FakeExerciseListsRepository()
    private val library = FakeExerciseLibraryRepository()
    private val dispatcher = StandardTestDispatcher()

    @Before fun setUp() {
        Dispatchers.setMain(dispatcher)
        library.exercises = listOf(exercise(10, "Squat"), exercise(11, "Bench"), exercise(12, "Row"))
        lists.lists = listOf(exerciseList(1, "Push", items = listOf(item(1, 10, 0), item(2, 11, 1))))
    }

    @After fun tearDown() = Dispatchers.resetMain()

    private fun TestScope.editor(list: Int = 1, units: UnitSystem = UnitSystem.Metric): ListEditorViewModel {
        val viewModel = ListEditorViewModel(lists, library, FakeAuthRepository(units), SavedStateHandle(mapOf(ListEditorViewModel.LIST_UUID to listUuid(list))))
        backgroundScope.launch { viewModel.state.collect {} }
        advanceUntilIdle()
        return viewModel
    }

    // Exercises by fixture number: exerciseUuid(10) is 10.
    private fun ListEditorViewModel.exerciseIds() = state.value.items.map { it.exerciseUuid.number() }

    private fun serverIds() = lists.lists.single().items.map { it.exerciseUuid.number() }

    private fun String.number() = substringAfterLast('-').toInt()

    @Test fun `loads the list with the catalog sorted by name, in the user's units`() = runTest(dispatcher) {
        val viewModel = editor(units = UnitSystem.Imperial)
        val state = viewModel.state.value
        assertEquals("Push", state.list?.name)
        assertEquals(listOf(10, 11), viewModel.exerciseIds())
        assertEquals(listOf("Bench", "Row", "Squat"), state.exercises.map { it.name })
        assertEquals(UnitSystem.Imperial, state.units)
    }

    @Test fun `a list that's gone fails the load`() = runTest(dispatcher) {
        val viewModel = editor(list = 9)
        assertTrue(viewModel.state.value.loadFailed)
        assertEquals(ListsMessage.NotFound, viewModel.state.value.message)
    }

    @Test fun `a drag saves the new order with the items' uuids`() = runTest(dispatcher) {
        val viewModel = editor()
        viewModel.move(itemUuid(2), itemUuid(1))
        viewModel.drop()
        advanceUntilIdle()

        assertEquals("save ${listUuid(1)} ${listOf(exerciseUuid(11), exerciseUuid(10))}", lists.calls.last())
        assertEquals(listOf(itemUuid(2), itemUuid(1)), lists.lists.single().items.map { it.uuid })
        assertEquals(listOf(11, 10), viewModel.exerciseIds())
    }

    @Test fun `an add and a reorder in flight together both land`() = runTest(dispatcher) {
        val viewModel = editor()
        viewModel.add(exerciseUuid(12))
        viewModel.move(itemUuid(2), itemUuid(1))
        viewModel.drop()
        advanceUntilIdle()

        assertEquals(listOf(11, 10, 12), serverIds())
        assertEquals(listOf(11, 10, 12), viewModel.exerciseIds())
    }

    @Test fun `remove and targets are saved, and a refusal shows the server's items`() = runTest(dispatcher) {
        val viewModel = editor()
        val targets = Prescription.NONE.copy(targetSets = 3, targetReps = 5, targetWeight = 100.0, notes = "  Belt ")
        viewModel.saveTargets(itemUuid(1), targets)
        advanceUntilIdle()
        assertEquals(targets.copy(notes = "Belt"), lists.lists.single().items.first().prescription)

        lists.failWith = ConfigError.ExerciseListFrozen
        viewModel.remove(itemUuid(2))
        advanceUntilIdle()
        assertEquals(listOf(10, 11), viewModel.exerciseIds())
        assertEquals(ListsMessage.Frozen, viewModel.state.value.message)
    }

    @Test fun `a frozen list is read-only but can be deleted`() = runTest(dispatcher) {
        lists.lists = listOf(exerciseList(1, "Old", items = listOf(item(1, 10, 0)), frozen = true))
        val viewModel = editor()
        assertFalse(viewModel.state.value.editable)

        viewModel.remove(itemUuid(1))
        viewModel.startAdding()
        viewModel.startRename()
        viewModel.editTargets(itemUuid(1))
        advanceUntilIdle()
        assertEquals(listOf("lists"), lists.calls)
        assertFalse(viewModel.state.value.adding)

        viewModel.delete()
        advanceUntilIdle()
        assertTrue(viewModel.state.value.done)
    }

    @Test fun `a rename to a taken name shows under the field`() = runTest(dispatcher) {
        val viewModel = editor()
        viewModel.startRename()
        lists.failWith = ConfigError.ExerciseListNameTaken
        viewModel.editRename { it.edit(name = "Pull") }
        viewModel.rename()
        advanceUntilIdle()
        assertTrue(viewModel.state.value.renaming!!.nameTaken)

        lists.failWith = null
        viewModel.editRename { it.edit(name = "Push day", description = " Chest ") }
        viewModel.rename()
        advanceUntilIdle()
        assertEquals(null, viewModel.state.value.renaming)
        assertEquals("Push day", viewModel.state.value.list?.name)
        assertEquals("Chest", viewModel.state.value.list?.description)
    }

    @Test fun `a full list says so instead of opening the picker`() = runTest(dispatcher) {
        lists.lists = listOf(exerciseList(1, "Long", items = List(100) { item(it + 1, 10, it) }))
        val viewModel = editor()
        viewModel.startAdding()
        advanceUntilIdle()
        assertFalse(viewModel.state.value.adding)
        assertEquals(ListsMessage.Full(100), viewModel.state.value.message)
    }
}
