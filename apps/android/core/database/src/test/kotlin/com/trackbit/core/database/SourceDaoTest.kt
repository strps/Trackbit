package com.trackbit.core.database

import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.Prescription
import com.trackbit.core.model.QueueEmptyReason
import com.trackbit.core.model.QueueEntry
import com.trackbit.core.model.ResolvedQueue
import com.trackbit.core.model.SourceCapabilities
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant

class SourceDaoTest : DatabaseTest() {
    private val sources = db.sourceDao()
    private val sync = db.syncDao()
    private val at = Instant.parse("2026-09-26T10:00:00Z")

    private fun source(key: String, name: String) =
        ExerciseSourceDescriptor(key, name, nameKey = null, itemCount = 2, SourceCapabilities(true, true, true, false), frozen = false)

    private val rx = Prescription(3, 8, 60.5, 90, null, 120, "Slow")

    private fun queue(key: String, vararg entries: QueueEntry) =
        ResolvedQueue(source(key, key), entries.toList(), emptyReason = null, generatedAt = at)

    @Test fun `sources keep the server's order and replace the old ones`() = runTest {
        sync.applySources(listOf(source("list:2", "B"), source("list:1", "A")))
        assertEquals(listOf("list:2", "list:1"), sources.observeSources().first().map { it.key })

        sync.applySources(listOf(source("list:1", "A")))
        assertEquals(listOf(source("list:1", "A")), sources.observeSources().first().map { it.toDescriptor() })
    }

    @Test fun `a queue round-trips in order, with its prescriptions`() = runTest {
        sync.applyQueue("list:1", queue("list:1", QueueEntry("e7", 0, "i10", rx), QueueEntry("e8", 1, "i11", null)), at)

        val cached = checkNotNull(sources.observeQueue("list:1").first())
        assertEquals(false, cached.queue.gone)
        assertEquals(
            listOf(QueueEntry("e7", 0, "i10", rx), QueueEntry("e8", 1, "i11", null)),
            cached.entries.sortedBy { it.ordinal }.map { it.toEntry() },
        )
        assertEquals(rx, sources.prescription("i10"))
        assertNull(sources.prescription("i11"))
        assertNull(sources.prescription("i99"))
    }

    @Test fun `a queue that no longer resolves is gone and loses its entries`() = runTest {
        sync.applyQueue("list:1", queue("list:1", QueueEntry("e7", 0, "i10", rx)), at)
        sync.applyQueue("list:1", null, at)

        val cached = checkNotNull(sources.observeQueue("list:1").first())
        assertTrue(cached.queue.gone)
        assertEquals(emptyList<Any>(), cached.entries)
        assertNull(sources.prescription("i10"))
    }

    @Test fun `an empty queue keeps its reason`() = runTest {
        sync.applyQueue("list:1", queue("list:1").copy(emptyReason = QueueEmptyReason.ListEmpty), at)
        assertEquals(QueueEmptyReason.ListEmpty, sources.observeQueue("list:1").first()?.queue?.emptyReason)
    }

    @Test fun `a source no longer listed takes its queue with it`() = runTest {
        sync.applySources(listOf(source("list:1", "A"), source("list:2", "B")))
        sync.applyQueue("list:1", queue("list:1", QueueEntry("e7", 0, "i10", rx)), at)
        sync.applyQueue("list:2", queue("list:2", QueueEntry("e8", 0, "i20", rx)), at)

        sync.applySources(listOf(source("list:2", "B")))
        assertNull(sources.observeQueue("list:1").first())
        assertNull(sources.prescription("i10"))
        assertEquals(rx, sources.prescription("i20"))
    }
}
