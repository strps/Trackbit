package com.trackbit.core.network.interceptor

import com.trackbit.core.network.IdempotencyKey
import okhttp3.Interceptor
import okhttp3.Response

/** Turns an [IdempotencyKey] request tag into the `Idempotency-Key` header. */
class IdempotencyKeyInterceptor : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val key = request.tag(IdempotencyKey::class.java) ?: return chain.proceed(request)
        return chain.proceed(request.newBuilder().header(IdempotencyKey.HEADER, key.value).build())
    }
}
