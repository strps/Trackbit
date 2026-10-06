package com.trackbit.core.network.service

import com.trackbit.core.model.Habit
import com.trackbit.core.model.HabitReorderRequest
import com.trackbit.core.model.HabitRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/** `/api/habits`: the habits config. Tracking reads habits from `/api/tracker/today` instead. */
interface HabitsService {
    /** Every habit of the user, in display order, with `frozen` computed. */
    @GET("api/habits")
    suspend fun habits(): List<Habit>

    /** The server picks the order: the end of the habit's group. */
    @POST("api/habits")
    suspend fun create(@Body body: HabitRequest): Habit

    /** A change of group moves the habit to the end of the other one. */
    @PUT("api/habits/uuid/{uuid}")
    suspend fun update(@Path("uuid") uuid: String, @Body body: HabitRequest): Habit

    /** Deletes the habit with all its logs and sessions. */
    @DELETE("api/habits/uuid/{uuid}")
    suspend fun delete(@Path("uuid") uuid: String)

    /** Sets every listed habit's group and order at once. */
    @PATCH("api/habits/reorder")
    suspend fun reorder(@Body body: HabitReorderRequest)
}
