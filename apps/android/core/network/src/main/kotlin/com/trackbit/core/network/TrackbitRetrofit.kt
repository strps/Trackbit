package com.trackbit.core.network

import com.trackbit.core.model.serialization.TrackbitJson
import com.trackbit.core.network.interceptor.AcceptLanguageInterceptor
import com.trackbit.core.network.interceptor.AuthInterceptor
import com.trackbit.core.network.interceptor.IdempotencyKeyInterceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

/** The client every Trackbit request goes through. */
fun trackbitOkHttpClient(
    tokens: SessionTokenSource,
    language: RequestLanguage = RequestLanguage.Device,
): OkHttpClient = OkHttpClient().withTrackbitHeaders(tokens, language)

/**
 * This client plus the API's headers, the session token among them. It shares this client's
 * connections and threads, while this one keeps sending none of those headers, so it can load
 * public URLs elsewhere (exercise media) without handing them the token.
 */
fun OkHttpClient.withTrackbitHeaders(tokens: SessionTokenSource, language: RequestLanguage): OkHttpClient = newBuilder()
    .addInterceptor(AcceptLanguageInterceptor(language))
    .addInterceptor(IdempotencyKeyInterceptor())
    .addInterceptor(AuthInterceptor(tokens))
    .build()

fun trackbitRetrofit(baseUrl: String, client: OkHttpClient): Retrofit = Retrofit.Builder()
    .baseUrl(baseUrl)
    .client(client)
    .addConverterFactory(TrackbitJson.asConverterFactory("application/json".toMediaType()))
    .build()
