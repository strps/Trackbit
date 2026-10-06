package com.trackbit.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

class ExerciseQueueTest {
    // Exercise 1 is "e1", list item 10 is "i10".
    private fun entry(exercise: Int, item: Int?) = QueueEntry("e$exercise", position = 0, item?.let { "i$it" }, prescription = null)

    private fun log(exercise: Int, item: Int?) = QueueLog("e$exercise", item?.let { "i$it" })

    /** A routine that repeats exercise 1: top set (item 10), then backoff (item 12). */
    private val routine = listOf(entry(1, 10), entry(2, 11), entry(1, 12))

    @Test fun `an empty queue has no cursor`() {
        assertEquals(-1, nextQueueIndex(emptyList(), listOf(log(1, null))))
    }

    @Test fun `the cursor is the first entry not done`() {
        assertEquals(0, nextQueueIndex(routine, emptyList()))
        assertEquals(1, nextQueueIndex(routine, listOf(log(1, 10))))
    }

    @Test fun `a repeated exercise is done by its list item, not by the exercise`() {
        val logs = listOf(log(1, 10), log(2, 11))
        assertEquals(listOf(true, true, false), queueDone(routine, logs))
        assertEquals(2, nextQueueIndex(routine, logs))
    }

    @Test fun `an ad-hoc log of a queued exercise doesn't advance a list`() {
        assertEquals(0, nextQueueIndex(routine, listOf(log(1, null))))
    }

    @Test fun `entries without a list item match by exercise`() {
        val computed = listOf(entry(5, null), entry(6, null))
        assertEquals(listOf(false, true), queueDone(computed, listOf(log(6, null))))
        assertEquals(0, nextQueueIndex(computed, listOf(log(6, null))))
    }

    @Test fun `a finished queue cycles on from the last logged entry`() {
        val all = listOf(log(1, 10), log(2, 11), log(1, 12))
        assertEquals(0, nextQueueIndex(routine, all))
        assertEquals(2, nextQueueIndex(routine, all + log(2, 11)))
        // The newest log that is in the queue counts; ad-hoc ones are skipped.
        assertEquals(2, nextQueueIndex(routine, all + log(2, 11) + log(9, null)))
    }
}
