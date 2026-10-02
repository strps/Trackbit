package com.trackbit.core.network.service

import com.trackbit.core.model.Exercise
import retrofit2.http.GET

/** `/api/exercise-info`. Names come localized for the request's `Accept-Language`. */
interface ExerciseService {
    /** System exercises plus the user's own, each with the user's last set of it. */
    @GET("api/exercise-info/exercises")
    suspend fun exercises(): List<Exercise>
}
