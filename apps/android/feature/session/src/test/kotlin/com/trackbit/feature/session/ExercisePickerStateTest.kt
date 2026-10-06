package com.trackbit.feature.session

import com.trackbit.core.data.SourceQueue
import com.trackbit.core.data.TrackedExerciseLog
import com.trackbit.core.data.TrackedSession
import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.QueueEmptyReason
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.model.SourceCapabilities
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDate

class ExercisePickerStateTest {
    private val day = LocalDate.of(2026, 10, 2)
    private val catalog = listOf(exercise(1, "Bench"), exercise(2, "Row"), exercise(3, "Squat"))
    private val pull = ExerciseSourceDescriptor("list:1", "Pull", null, 3, SourceCapabilities(true, true, false, false), false)

    /** Row (item 10), Bench (item 11), Row again (item 12). */
    private val queue = SourceQueue.Resolved(
        listOf(QueueEntry(exerciseUuid(2), 0, itemUuid(10), null), QueueEntry(exerciseUuid(1), 1, itemUuid(11), null), QueueEntry(exerciseUuid(2), 2, itemUuid(12), null)),
        emptyReason = null,
    )

    private fun state(source: ExerciseSourceDescriptor? = pull, queue: SourceQueue? = this.queue) =
        SessionUiState(day = day, exercises = catalog, source = source, queue = queue)

    private fun session(vararg logs: Pair<Int, Int?>) = TrackedSession(
        id = "s", habitUuid = "habit-1", day = day, createdAt = Instant.EPOCH,
        logs = logs.mapIndexed { i, (exercise, item) ->
            TrackedExerciseLog("l$i", exerciseUuid(exercise), item?.let(::itemUuid), null, null, null, null, emptyList())
        },
    )

    @Test fun `with a source, Play adds the cursor's entry and walks the queue`() {
        val fresh = exercisePicker(state(), session(), browsePick = null)
        assertFalse(fresh.browsing)
        assertEquals(QueueEntry(exerciseUuid(2), 0, itemUuid(10), null), fresh.nextEntry)
        assertEquals("Row", fresh.selected?.name)

        val second = exercisePicker(state(), session(2 to 10), browsePick = null)
        assertEquals(QueueEntry(exerciseUuid(1), 1, itemUuid(11), null), second.nextEntry)
        assertEquals(listOf(true, false, false), second.done)
        assertEquals(listOf(false, true, false), second.queueRows.map { it.highlighted })
    }

    @Test fun `browse mode repeats the last pick, else the last logged exercise`() {
        val resumed = exercisePicker(state(source = null), session(3 to null, 1 to null), browsePick = null)
        assertTrue(resumed.browsing)
        assertNull(resumed.nextEntry)
        assertEquals("Bench", resumed.selected?.name)
        assertEquals("Squat", exercisePicker(state(source = null), session(1 to null), browsePick = exerciseUuid(3)).selected?.name)
        assertNull(exercisePicker(state(source = null), session(), browsePick = null).selected)
    }

    @Test fun `a source that no longer resolves is browse mode`() {
        val picker = exercisePicker(state(queue = SourceQueue.Gone), session(1 to null), browsePick = null)
        assertTrue(picker.browsing)
        assertNull(picker.source)
        assertEquals("Bench", picker.selected?.name)
    }

    @Test fun `a queue not pulled yet is loading, and an empty one says why`() {
        val loading = exercisePicker(state(queue = null), session(), browsePick = null)
        assertTrue(loading.queueLoading)
        assertNull(loading.selected)

        val empty = exercisePicker(state(queue = SourceQueue.Resolved(emptyList(), QueueEmptyReason.ListEmpty)), session(), browsePick = null)
        assertFalse(empty.queueLoading)
        assertEquals(QueueEmptyReason.ListEmpty, empty.emptyReason)
        assertEquals(-1, empty.cursor)
    }

    @Test fun `a search covers the catalog and links queued exercises to their first entry not done`() {
        val picker = exercisePicker(state(), session(2 to 10), browsePick = null)
        val rows = picker.search("o").associateBy { it.exercise.name }
        assertEquals(setOf("Row"), rows.keys)
        // Row's first entry (item 10) is done, so the link moves on to item 12.
        assertEquals(itemUuid(12), rows.getValue("Row").entry?.listItemUuid)

        val all = picker.search("")
        assertEquals(listOf("Bench", "Row", "Squat"), all.map { it.exercise.name })
        assertTrue("Bench is the cursor", all[0].highlighted)
        assertNull(all[2].entry)

        val browsing = exercisePicker(state(source = null), session(), browsePick = null).search("")
        assertTrue("nothing links in browse mode", browsing.all { it.entry == null })
    }

    private fun exercise(n: Int, name: String) =
        Exercise(exerciseUuid(n), userId = null, name = name, category = "strength", defaultWeightUnit = "kg", defaultDistanceUnit = "km", lastPerformance = null)
}
