package com.trackbit.core.model

import com.trackbit.core.model.serialization.TrackbitJson
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class IssueRulesTest {
    @Test fun `the client names the build and the device once`() {
        assertEquals(
            "Trackbit Android 0.1.0 (1) · Google Pixel 8 · Android 16 (API 36)",
            IssueRules.client("0.1.0", 1, "Google", "Pixel 8", "16", 36),
        )
        assertEquals(
            "Trackbit Android 0.1.0 (1) · samsung SM-S911B · Android 14 (API 34)",
            IssueRules.client("0.1.0", 1, "samsung", "SM-S911B", "14", 34),
        )
        assertEquals(
            "Trackbit Android 0.1.0 (1) · ONEPLUS 12 · Android 15 (API 35)",
            IssueRules.client("0.1.0", 1, "OnePlus", "ONEPLUS 12", "15", 35),
        )
    }

    @Test fun `the client fits the server's column`() {
        val client = IssueRules.client("0.1.0", 1, "Acme", "x".repeat(400), "16", 36)
        assertEquals(IssueRules.CLIENT_MAX, client.length)
    }

    @Test fun `the description is checked trimmed`() {
        assertFalse(IssueRules.descriptionValid("   "))
        assertTrue(IssueRules.descriptionValid(" a "))
        assertTrue(IssueRules.descriptionValid("x".repeat(IssueRules.DESCRIPTION_MAX)))
        assertFalse(IssueRules.descriptionValid("x".repeat(IssueRules.DESCRIPTION_MAX + 1)))
    }

    @Test fun `a report encodes the wire type`() {
        assertEquals(
            """{"type":"feedback","description":"More widgets","client":"Trackbit Android"}""",
            TrackbitJson.encodeToString(IssueRequest.serializer(), IssueRequest(IssueType.Feedback, "More widgets", "Trackbit Android")),
        )
    }
}
