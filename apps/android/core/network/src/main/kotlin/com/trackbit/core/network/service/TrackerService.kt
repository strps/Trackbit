package com.trackbit.core.network.service

import com.trackbit.core.model.CheckRequest
import com.trackbit.core.model.DaysResponse
import com.trackbit.core.model.DayLog
import com.trackbit.core.model.EnsureDayLogRequest
import com.trackbit.core.model.IncrementRequest
import com.trackbit.core.model.TodayResponse
import com.trackbit.core.network.IdempotencyKey
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
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
}
