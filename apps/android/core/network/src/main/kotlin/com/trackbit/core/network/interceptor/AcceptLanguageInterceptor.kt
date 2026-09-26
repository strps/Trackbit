package com.trackbit.core.network.interceptor

import okhttp3.Interceptor
import okhttp3.Response
import java.util.Locale

/**
 * Tells the server which language to localize into (exercise names, error messages). The app's
 * per-app language, once applied, is the default locale, so it is read on every request.
 */
class AcceptLanguageInterceptor(
    private val locale: () -> Locale = Locale::getDefault,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        if (request.header(HEADER) != null) return chain.proceed(request)
        return chain.proceed(request.newBuilder().header(HEADER, locale().toLanguageTag()).build())
    }

    private companion object {
        const val HEADER = "Accept-Language"
    }
}
