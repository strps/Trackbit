package com.trackbit.app

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat

/**
 * The app's language is the signed-in user's locale, as on the web (which syncs i18next from the
 * session): changed in Account settings here or on another device, it follows. Signed out, the
 * last one stays. AppCompat stores it on Android 8–12; the system does from 13.
 */
internal object AppLanguage {
    /** Applies [locale] unless it already is the app's language; applying recreates activities. */
    fun follow(locale: String) {
        val wanted = LocaleListCompat.forLanguageTags(locale)
        if (AppCompatDelegate.getApplicationLocales().toLanguageTags() != wanted.toLanguageTags()) {
            AppCompatDelegate.setApplicationLocales(wanted)
        }
    }
}
