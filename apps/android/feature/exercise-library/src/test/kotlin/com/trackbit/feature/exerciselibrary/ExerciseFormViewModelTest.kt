package com.trackbit.feature.exerciselibrary

import androidx.lifecycle.SavedStateHandle
import com.trackbit.core.data.ConfigError
import com.trackbit.core.model.ExerciseCategory
import com.trackbit.core.model.ExerciseDifficulty
import com.trackbit.core.model.ExerciseEquipment
import com.trackbit.core.model.ExerciseRequest
import com.trackbit.core.model.ExerciseRules
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
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class ExerciseFormViewModelTest {
    private val repository = FakeExerciseLibraryRepository()
    private val dispatcher = StandardTestDispatcher()

    @Before fun setUp() {
        Dispatchers.setMain(dispatcher)
        repository.muscleGroups = listOf(group(2, "Back", order = 1), group(1, "Chest", order = 0))
        repository.exercises = listOf(
            exercise(5, "Bench", category = "strength"),
            exercise(7, "Dips", mine = true, category = "cardio", description = "Lean forward", muscles = listOf(MuscleGroupRef(1, "Chest")), logged = true),
            exercise(8, "Old", mine = true, frozen = true),
            exercise(9, "Smith bench", mine = true).copy(
                instructions = listOf("Set the safeties", "Press"),
                tips = listOf("Elbows at 45°"),
                equipment = listOf("machine", "bench", "hoverboard"),
                difficulty = "beginner",
                variantOfUuid = exerciseUuid(5),
            ),
        )
    }

    /** A request with no info fields, as a form that never touched them sends. */
    private fun request(name: String, description: String?, category: ExerciseCategory, muscleGroups: List<Int>) =
        ExerciseRequest(
            name, description, category, muscleGroups,
            instructions = null, tips = null, commonMistakes = null, equipment = emptyList(), difficulty = null, variantOfUuid = null,
        )

    @After fun tearDown() = Dispatchers.resetMain()

    private fun TestScope.form(n: Int? = null, savedState: SavedStateHandle = SavedStateHandle()): ExerciseFormViewModel {
        if (n != null) savedState[ExerciseFormViewModel.EXERCISE_UUID] = exerciseUuid(n)
        val viewModel = ExerciseFormViewModel(repository, savedState)
        advanceUntilIdle()
        return viewModel
    }

    @Test fun `a new exercise is created trimmed, with a blank description cleared`() = runTest(dispatcher) {
        val viewModel = form()
        assertEquals(listOf("Chest", "Back"), viewModel.state.value.muscleGroups.map { it.name })

        viewModel.edit { it.copy(name = "  Dips ", description = "   ", category = ExerciseCategory.Flexibility) }
        viewModel.toggleMuscleGroup(2)
        viewModel.toggleMuscleGroup(1)
        viewModel.save()
        advanceUntilIdle()

        val created = repository.created.single()
        assertEquals(request("Dips", null, ExerciseCategory.Flexibility, listOf(1, 2)), created.copy(uuid = null))
        assertNotNull(created.uuid)
        assertTrue(viewModel.state.value.done)
    }

    @Test fun `a retried create sends the same uuid, after process death too`() = runTest(dispatcher) {
        val savedState = SavedStateHandle()
        val viewModel = form(savedState = savedState)
        viewModel.edit { it.copy(name = "Dips") }
        repository.failWith = ConfigError.Offline
        viewModel.save()
        advanceUntilIdle()
        repository.failWith = null
        viewModel.save()
        advanceUntilIdle()

        val restored = form(savedState = savedState)
        restored.edit { it.copy(name = "Dips") }
        restored.save()
        advanceUntilIdle()
        assertEquals(1, repository.created.map { it.uuid }.distinct().size)
        assertEquals(3, repository.created.size)
    }

    @Test fun `problems show only after trying to save, and nothing is sent`() = runTest(dispatcher) {
        val viewModel = form()
        viewModel.edit { it.copy(name = " ", description = "x".repeat(ExerciseRules.DESCRIPTION_MAX + 1)) }
        assertFalse(viewModel.state.value.showProblems)

        viewModel.save()
        advanceUntilIdle()
        assertTrue(viewModel.state.value.showProblems)
        assertEquals(setOf(ExerciseRules.Problem.NameLength, ExerciseRules.Problem.DescriptionLength), viewModel.state.value.form.problems)
        assertTrue(repository.created.isEmpty())
    }

    @Test fun `editing loads the user's exercise and sends every field`() = runTest(dispatcher) {
        val viewModel = form(7)
        val state = viewModel.state.value
        assertEquals(ExerciseForm("Dips", "Lean forward", ExerciseCategory.Cardio, setOf(1)), state.form)
        assertTrue(state.logged)

        viewModel.toggleMuscleGroup(1)
        viewModel.save()
        advanceUntilIdle()
        assertEquals(exerciseUuid(7) to request("Dips", "Lean forward", ExerciseCategory.Cardio, emptyList()), repository.updated.single())
    }

    @Test fun `a system exercise or a missing one doesn't open`() = runTest(dispatcher) {
        for (id in listOf(5, 99)) {
            val state = form(id).state.value
            assertTrue(state.loadFailed)
            assertEquals(ExerciseFormMessage.NotFound, state.message)
        }
    }

    @Test fun `a frozen exercise is read-only but can be deleted`() = runTest(dispatcher) {
        val viewModel = form(8)
        assertTrue(viewModel.state.value.frozen)
        assertFalse(viewModel.state.value.canSave)

        viewModel.delete()
        advanceUntilIdle()
        assertEquals(listOf(exerciseUuid(8)), repository.deleted)
        assertTrue(viewModel.state.value.done)
    }

    @Test fun `a taken name shows on the field until the name changes`() = runTest(dispatcher) {
        val viewModel = form()
        viewModel.edit { it.copy(name = "Dips") }
        repository.failWith = ConfigError.ExerciseNameTaken
        viewModel.save()
        advanceUntilIdle()
        assertTrue(viewModel.state.value.nameTaken)
        assertFalse(viewModel.state.value.done)

        viewModel.edit { it.copy(description = "still taken") }
        assertTrue(viewModel.state.value.nameTaken)
        viewModel.edit { it.copy(name = "Ring dips") }
        assertFalse(viewModel.state.value.nameTaken)
    }

    @Test fun `frozen meanwhile turns the form read-only`() = runTest(dispatcher) {
        val viewModel = form(7)
        repository.failWith = ConfigError.CustomExerciseFrozen
        viewModel.save()
        advanceUntilIdle()
        assertTrue(viewModel.state.value.frozen)
        assertEquals(ExerciseFormMessage.Frozen, viewModel.state.value.message)
    }

    @Test fun `an edit sends the exercise's info back, minus equipment this build doesn't know`() = runTest(dispatcher) {
        val viewModel = form(9)
        viewModel.edit { it.copy(name = "Smith press") }
        viewModel.save()
        advanceUntilIdle()

        val sent = repository.updated.single().second
        assertEquals(listOf("Set the safeties", "Press"), sent.instructions)
        assertEquals(listOf("Elbows at 45°"), sent.tips)
        assertNull(sent.commonMistakes)
        assertEquals(listOf(ExerciseEquipment.Machine, ExerciseEquipment.Bench), sent.equipment)
        assertEquals(ExerciseDifficulty.Beginner, sent.difficulty)
        assertEquals(exerciseUuid(5), sent.variantOfUuid)
    }

    @Test fun `blank steps are dropped, and a list left blank is cleared`() = runTest(dispatcher) {
        val viewModel = form(9)
        viewModel.edit { it.copy(instructions = listOf(" Set the safeties ", "  ", "Press"), tips = listOf(" ")) }
        viewModel.save()
        advanceUntilIdle()

        val sent = repository.updated.single().second
        assertEquals(listOf("Set the safeties", "Press"), sent.instructions)
        assertNull(sent.tips)
    }

    @Test fun `too many steps is a problem`() = runTest(dispatcher) {
        val viewModel = form()
        viewModel.edit { it.copy(name = "Dips", commonMistakes = List(ExerciseRules.STEPS_MAX + 1) { "Shrugging $it" }) }
        viewModel.save()
        advanceUntilIdle()
        assertEquals(setOf(ExerciseRules.Problem.CommonMistakes), viewModel.state.value.form.problems)
        assertTrue(repository.created.isEmpty())
    }
}
