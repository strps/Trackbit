package com.trackbit.core.network.service

import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.ResolvedQueue
import retrofit2.http.GET
import retrofit2.http.Path

/** `/api/exercise-info` and `/api/exercise-sources`. Names come localized for the request's `Accept-Language`. */
interface ExerciseService {
    /** System exercises plus the user's own, each with the user's last set of it. */
    @GET("api/exercise-info/exercises")
    suspend fun exercises(): List<Exercise>

    /** Every source the picker can offer: the user's lists, and later programs and computed sources. */
    @GET("api/exercise-sources")
    suspend fun sources(): List<ExerciseSourceDescriptor>

    /** [key]'s queue. 404 when the source no longer resolves (a deleted list): browse mode, not an error. */
    @GET("api/exercise-sources/{key}")
    suspend fun source(@Path("key") key: String): ResolvedQueue
}
