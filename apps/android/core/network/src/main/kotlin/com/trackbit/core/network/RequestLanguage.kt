package com.trackbit.core.network

import java.util.Locale

/**
 * The language the server should answer in (exercise names, error messages). `core:auth`
 * implements it with the signed-in user's locale, which is also the app's language; signed out,
 * the device's. Called on OkHttp's threads for every request, so it must return from memory.
 */
fun interface RequestLanguage {
    fun current(): Locale

    companion object {
        /** The default locale: the device's, or the per-app language once applied. */
        val Device = RequestLanguage { Locale.getDefault() }
    }
}
