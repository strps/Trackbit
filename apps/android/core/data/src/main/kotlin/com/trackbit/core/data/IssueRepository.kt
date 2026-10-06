package com.trackbit.core.data

import android.os.Build
import com.trackbit.core.model.IssueRequest
import com.trackbit.core.model.IssueRules
import com.trackbit.core.model.IssueType
import com.trackbit.core.network.safeCall
import com.trackbit.core.network.service.IssueService
import javax.inject.Inject

/** Bug reports and feedback (the web's "Report a Bug"). Needs a connection, like config. */
interface IssueRepository {
    /** What every report says sent it: this build and device ([IssueRules.client]). */
    val client: String

    /** Files the report; [description] must pass [IssueRules.descriptionValid] and is sent trimmed. */
    suspend fun report(type: IssueType, description: String): ConfigResult<Unit>
}

internal class DefaultIssueRepository @Inject constructor(
    private val issueService: IssueService,
    build: AppBuild,
) : IssueRepository {
    override val client = IssueRules.client(
        versionName = build.versionName,
        versionCode = build.versionCode,
        manufacturer = Build.MANUFACTURER,
        model = Build.MODEL,
        release = Build.VERSION.RELEASE,
        sdk = Build.VERSION.SDK_INT,
    )

    override suspend fun report(type: IssueType, description: String) =
        safeCall { issueService.report(IssueRequest(type, description.trim(), client)) }.toConfigResult()
}
