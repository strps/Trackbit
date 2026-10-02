package com.trackbit.core.model

import org.junit.Assert.assertEquals
import org.junit.Test

class ExerciseQueueTest {
    private fun entry(exerciseId: Int, listItemId: Int?) = QueueEntry(exerciseId, position = 0, listItemId, prescription = null)

    /** A routine that repeats exercise 1: top set (item 10), then backoff (item 12). */
    private val routine = listOf(entry(1, 10), entry(2, 11), entry(1, 12))

    @Test fun `an empty queue has no cursor`() {
        assertEquals(-1, nextQueueIndex(emptyList(), listOf(QueueLog(1, null))))
    }

    @Test fun `the cursor is the first entry not done`() {
        assertEquals(0, nextQueueIndex(routine, emptyList()))
        assertEquals(1, nextQueueIndex(routine, listOf(QueueLog(1, 10))))
    }

    @Test fun `a repeated exercise is done by its list item, not by the exercise`() {
        val logs = listOf(QueueLog(1, 10), QueueLog(2, 11))
        assertEquals(listOf(true, true, false), queueDone(routine, logs))
        assertEquals(2, nextQueueIndex(routine, logs))
    }

    @Test fun `an ad-hoc log of a queued exercise doesn't advance a list`() {
        assertEquals(0, nextQueueIndex(routine, listOf(QueueLog(1, null))))
    }

    @Test fun `entries without a list item match by exercise`() {
        val computed = listOf(entry(5, null), entry(6, null))
        assertEquals(listOf(false, true), queueDone(computed, listOf(QueueLog(6, null))))
        assertEquals(0, nextQueueIndex(computed, listOf(QueueLog(6, null))))
    }

    @Test fun `a finished queue cycles on from the last logged entry`() {
        val all = listOf(QueueLog(1, 10), QueueLog(2, 11), QueueLog(1, 12))
        assertEquals(0, nextQueueIndex(routine, all))
        assertEquals(2, nextQueueIndex(routine, all + QueueLog(2, 11)))
        // The newest log that is in the queue counts; ad-hoc ones are skipped.
        assertEquals(2, nextQueueIndex(routine, all + QueueLog(2, 11) + QueueLog(9, null)))
    }
}
