package com.trackbit.core.network.interceptor

import com.trackbit.core.network.RequestLanguage
import okhttp3.Interceptor
import okhttp3.Response

/** Tells the server which language to localize into, read on every request. */
class AcceptLanguageInterceptor(
    private val language: RequestLanguage = RequestLanguage.Device,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.header(HEADER) != null) return chain.proceed(request)
        return chain.proceed(request.newBuilder().header(HEADER, language.current().toLanguageTag()).build())
    }

    private companion object {
        const val HEADER = "Accept-Language"
    }
}
