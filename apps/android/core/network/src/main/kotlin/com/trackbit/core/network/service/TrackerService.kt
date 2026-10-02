package com.trackbit.core.network.service

import com.trackbit.core.model.CheckRequest
import com.trackbit.core.model.CreateExerciseLogRequest
import com.trackbit.core.model.CreatePerformanceRequest
import com.trackbit.core.model.CreateSessionRequest
import com.trackbit.core.model.ExerciseLog
import com.trackbit.core.model.ExercisePerformance
import com.trackbit.core.model.ExerciseSession
import com.trackbit.core.model.ExerciseSessionDetail
import com.trackbit.core.model.SetValues
import com.trackbit.core.model.DaysResponse
import com.trackbit.core.model.DayLog
import com.trackbit.core.model.EnsureDayLogRequest
import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.model.TodayResponse
import com.trackbit.core.network.IdempotencyKey
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Tag
import java.time.LocalDate

/**
 * `/api/tracker`. Every write takes the [IdempotencyKey] its outbox op was queued with, so a
 * retry after a lost response is not applied twice.
 */
interface TrackerService {
    /** [day] null means the server's today for the user. */
    @GET("api/tracker/today")
    suspend fun today(@Query("day") day: LocalDate? = null): TodayResponse

    /** Logged days from [start] to [end] (at most 371 days), for every habit. */
    @GET("api/tracker/days")
    suspend fun days(@Query("start") start: LocalDate, @Query("end") end: LocalDate): DaysResponse

    @POST("api/tracker/check")
    suspend fun check(@Body body: CheckRequest, @Tag key: IdempotencyKey): DayLog

    @POST("api/tracker/check/increment")
    suspend fun increment(@Body body: IncrementRequest, @Tag key: IdempotencyKey): DayLog

    @POST("api/tracker/day-logs/ensure")
    suspend fun ensureDayLog(@Body body: EnsureDayLogRequest, @Tag key: IdempotencyKey): DayLog

    /** One habit's sessions on [day], oldest first, with their logs and sets. */
    @GET("api/tracker/exercise-sessions")
    suspend fun sessions(@Query("habitId") habitId: Int, @Query("day") day: LocalDate): List<ExerciseSessionDetail>

    @POST("api/tracker/exercise-sessions")
    suspend fun createSession(@Body body: CreateSessionRequest, @Tag key: IdempotencyKey): ExerciseSession

    /** A 404 means it is already gone. */
    @DELETE("api/tracker/exercise-sessions/uuid/{uuid}")
    suspend fun deleteSession(@Path("uuid") uuid: String, @Tag key: IdempotencyKey)

    @POST("api/tracker/exercise-logs")
    suspend fun createExerciseLog(@Body body: CreateExerciseLogRequest, @Tag key: IdempotencyKey): ExerciseLog

    /** A 404 means it is already gone. */
    @DELETE("api/tracker/exercise-logs/uuid/{uuid}")
    suspend fun deleteExerciseLog(@Path("uuid") uuid: String, @Tag key: IdempotencyKey)

    @POST("api/tracker/exercise-performances")
    suspend fun createPerformance(@Body body: CreatePerformanceRequest, @Tag key: IdempotencyKey): ExercisePerformance

    @PATCH("api/tracker/exercise-performances/uuid/{uuid}")
    suspend fun updatePerformance(@Path("uuid") uuid: String, @Body values: SetValues, @Tag key: IdempotencyKey): ExercisePerformance

    /** A 404 means it is already gone. */
    @DELETE("api/tracker/exercise-performances/uuid/{uuid}")
    suspend fun deletePerformance(@Path("uuid") uuid: String, @Tag key: IdempotencyKey)
}
