package com.trackbit.core.network.service

import com.trackbit.core.model.Exercise
import com.trackbit.core.model.ExerciseRequest
import com.trackbit.core.model.ExerciseSourceDescriptor
import com.trackbit.core.model.MuscleGroup
import com.trackbit.core.model.ResolvedQueue
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path

/** `/api/exercise-info` and `/api/exercise-sources`. Names come localized for the request's `Accept-Language`. */
interface ExerciseService {
    /** System exercises plus the user's own, each with the user's last set of it. */
    @GET("api/exercise-info/exercises")
    suspend fun exercises(): List<Exercise>

    /** A new custom exercise, answered as a row of [exercises]. */
    @POST("api/exercise-info/exercises")
    suspend fun createExercise(@Body body: ExerciseRequest): Exercise

    /** One of the user's own exercises; a system one answers 404, a frozen one 403. */
    @PATCH("api/exercise-info/exercises/{id}")
    suspend fun updateExercise(@Path("id") id: Int, @Body body: ExerciseRequest): Exercise

    /** Deletes one of the user's own exercises with every log of it (and their sets) and its list items. */
    @DELETE("api/exercise-info/exercises/{id}")
    suspend fun deleteExercise(@Path("id") id: Int)

    /** The shared muscle group taxonomy. */
    @GET("api/exercise-info/muscle-groups")
    suspend fun muscleGroups(): List<MuscleGroup>

    /** Every source the picker can offer: the user's lists, and later programs and computed sources. */
    @GET("api/exercise-sources")
    suspend fun sources(): List<ExerciseSourceDescriptor>

    /** [key]'s queue. 404 when the source no longer resolves (a deleted list): browse mode, not an error. */
    @GET("api/exercise-sources/{key}")
    suspend fun source(@Path("key") key: String): ResolvedQueue
}
