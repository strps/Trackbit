package com.trackbit.core.network.interceptor

import com.trackbit.core.network.SessionTokenSource
import okhttp3.Interceptor
import okhttp3.Response

/** Sends the bearer token and reports a 401 on a request that carried one. */
class AuthInterceptor(private val tokens: SessionTokenSource) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = tokens.currentToken()
        val request = if (token == null) {
            chain.request()
        } else {
            chain.request().newBuilder().header("Authorization", "Bearer $token").build()
        }
        val response = chain.proceed(request)
        if (response.code == 401 && token != null) tokens.onUnauthorized(token)
        return response
    }
}
