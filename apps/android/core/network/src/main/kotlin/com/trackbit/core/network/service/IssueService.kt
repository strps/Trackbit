package com.trackbit.core.network.service

import com.trackbit.core.model.IssueRequest
import retrofit2.http.Body
import retrofit2.http.POST

/** `/api/issues`: bug reports and feedback, read by admins. */
interface IssueService {
    /** Files the report; the app doesn't read the stored row back. */
    @POST("api/issues")
    suspend fun report(@Body body: IssueRequest)
}
