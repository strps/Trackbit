package com.trackbit.widget.preview

import android.content.Context
import android.content.SharedPreferences
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class PublishIfStaleTest {
    private val prefs: SharedPreferences = ApplicationProvider.getApplicationContext<Context>()
        .getSharedPreferences("widget_previews_test", Context.MODE_PRIVATE)
    private var calls = 0

    private suspend fun publish(name: String, key: String, succeeds: Boolean = true) =
        publishIfStale(prefs, name, key) { calls++; succeeds }

    @Test fun `publishes once per render key`() = runTest {
        publish("today", "install-1|en")
        publish("today", "install-1|en")
        assertEquals(1, calls)
        publish("today", "install-1|es")
        publish("today", "install-2|es")
        assertEquals("a new locale or install publishes again", 3, calls)
    }

    @Test fun `a refused publish is retried on the next call`() = runTest {
        publish("today", "install-1|en", succeeds = false)
        publish("today", "install-1|en")
        publish("today", "install-1|en")
        assertEquals(2, calls)
    }

    @Test fun `each widget is tracked on its own`() = runTest {
        publish("today", "install-1|en")
        publish("heatmap", "install-1|en", succeeds = false)
        publish("today", "install-1|en")
        publish("heatmap", "install-1|en")
        assertEquals("only the refused one retries", 3, calls)
    }
}
