package com.trackbit.core.network.service

import com.trackbit.core.model.AppendListItemRequest
import com.trackbit.core.model.ExerciseList
import com.trackbit.core.model.ExerciseListItemsRequest
import com.trackbit.core.model.ExerciseListItemsResponse
import com.trackbit.core.model.ExerciseListReorderRequest
import com.trackbit.core.model.ExerciseListRequest
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path

/** `/api/exercise-lists`: the user's lists. A frozen list answers 403 to every write but delete. */
interface ExerciseListService {
    /** Every list with its items, in order. */
    @GET("api/exercise-lists")
    suspend fun lists(): List<ExerciseList>

    @POST("api/exercise-lists")
    suspend fun create(@Body body: ExerciseListRequest): ExerciseList

    @PATCH("api/exercise-lists/{id}")
    suspend fun update(@Path("id") id: Int, @Body body: ExerciseListRequest): ExerciseList

    /** Every list in its new order; frozen lists must stay at the end. */
    @PATCH("api/exercise-lists/reorder")
    suspend fun reorder(@Body body: ExerciseListReorderRequest): List<ExerciseList>

    /** Deletes the list and its items; logs made from them keep their exercise. */
    @DELETE("api/exercise-lists/{id}")
    suspend fun delete(@Path("id") id: Int)

    /** Replaces the list's items (an item with an id keeps its row). */
    @PUT("api/exercise-lists/{id}/items")
    suspend fun putItems(@Path("id") id: Int, @Body body: ExerciseListItemsRequest): ExerciseListItemsResponse

    /** Appends one exercise at the end, unprescribed. */
    @POST("api/exercise-lists/{id}/items")
    suspend fun append(@Path("id") id: Int, @Body body: AppendListItemRequest): ExerciseListItemsResponse
}
