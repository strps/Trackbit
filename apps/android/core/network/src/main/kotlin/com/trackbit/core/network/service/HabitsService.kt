package com.trackbit.core.network.service

import com.trackbit.core.model.Habit
import retrofit2.http.GET

/** `/api/habits`. Create, update, reorder and delete arrive with the habits config (Phase 3). */
interface HabitsService {
    /** Every habit of the user, in display order, with `frozen` computed. */
    @GET("api/habits")
    suspend fun habits(): List<Habit>
}
