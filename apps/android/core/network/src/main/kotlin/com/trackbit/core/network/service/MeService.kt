package com.trackbit.core.network.service

import com.trackbit.core.model.LimitsResponse
import com.trackbit.core.model.PreferencesRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH

/** `/api/me`: the signed-in user's own settings. */
interface MeService {
    /** Answers 204; read the new values back from `get-session`. */
    @PATCH("api/me/preferences")
    suspend fun updatePreferences(@Body body: PreferencesRequest)

    @GET("api/me/limits")
    suspend fun limits(): LimitsResponse
}
