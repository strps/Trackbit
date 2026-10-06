package com.trackbit.feature.account

import com.trackbit.core.data.ConfigError
import com.trackbit.core.data.ConfigResult
import com.trackbit.core.data.IssueRepository
import com.trackbit.core.model.IssueRules
import com.trackbit.core.model.IssueType
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
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
class IssueReportViewModelTest {
    private val dispatcher = StandardTestDispatcher()
    private val issues = FakeIssues()
    private val viewModel by lazy { IssueReportViewModel(issues) }

    @Before fun setUp() = Dispatchers.setMain(dispatcher)

    @After fun tearDown() = Dispatchers.resetMain()

    @Test fun `shows what the report says sent it, and starts as a bug`() {
        assertEquals("Trackbit Android test", viewModel.state.value.client)
        assertEquals(IssueType.Bug, viewModel.state.value.type)
    }

    @Test fun `a blank description sends nothing`() = runTest(dispatcher) {
        viewModel.editDescription("   ")
        assertFalse(viewModel.state.value.canSend)
        viewModel.send()
        advanceUntilIdle()
        assertTrue(issues.sent.isEmpty())
    }

    @Test fun `sends the type and description once, then shows the thanks`() = runTest(dispatcher) {
        viewModel.selectType(IssueType.Feedback)
        viewModel.editDescription(" More widgets ")
        viewModel.send()
        viewModel.send()
        advanceUntilIdle()
        assertEquals(listOf(IssueType.Feedback to " More widgets "), issues.sent)
        assertTrue(viewModel.state.value.sent)
        assertFalse(viewModel.state.value.canSend)
    }

    @Test fun `a failure keeps the text, says why, and clears when editing`() = runTest(dispatcher) {
        issues.result = ConfigResult.Failure(ConfigError.Offline)
        viewModel.editDescription("Crash on save")
        viewModel.send()
        advanceUntilIdle()
        assertEquals(IssueReportError.Offline, viewModel.state.value.error)
        assertEquals("Crash on save", viewModel.state.value.description)
        assertTrue(viewModel.state.value.canSend)

        issues.result = ConfigResult.Failure(ConfigError.Failed)
        viewModel.send()
        advanceUntilIdle()
        assertEquals(IssueReportError.Failed, viewModel.state.value.error)
        viewModel.editDescription("Crash on save!")
        assertNull(viewModel.state.value.error)
    }

    @Test fun `the description stops at the server's limit`() {
        viewModel.editDescription("x".repeat(IssueRules.DESCRIPTION_MAX + 10))
        assertEquals(IssueRules.DESCRIPTION_MAX, viewModel.state.value.description.length)
    }

    private class FakeIssues : IssueRepository {
        override val client = "Trackbit Android test"
        var result: ConfigResult<Unit> = ConfigResult.Success(Unit)
        val sent = mutableListOf<Pair<IssueType, String>>()

        override suspend fun report(type: IssueType, description: String): ConfigResult<Unit> {
            sent += type to description
            return result
        }
    }
}
