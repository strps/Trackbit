package com.trackbit.widget.preview

import android.appwidget.AppWidgetProviderInfo
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import androidx.collection.intSetOf
import androidx.core.content.edit
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import com.trackbit.widget.goAsync
import com.trackbit.widget.heatmap.HeatmapWidgetReceiver
import com.trackbit.widget.quicklog.QuickLogWidgetReceiver
import com.trackbit.widget.today.TodayWidgetReceiver
import com.trackbit.widget.widgetEntryPoint
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.reflect.KClass

/**
 * Publishes the generated previews the widget picker shows on Android 15+ (the static
 * previewLayouts cover 12–14). The system stores a published preview as rendered, so it is
 * republished only when the render would change: an install or update (the layouts and their
 * resource ids) or a locale change (the text). The system rate-limits publishing per widget, so
 * each one's success is recorded on its own, and a refused one is retried on the next trigger. Call [start] once, from `Application.onCreate`; [WidgetPreviewReceiver] covers the
 * update and locale broadcasts.
 */
@Singleton
class WidgetPreviews @Inject internal constructor(@ApplicationContext private val context: Context) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val mutex = Mutex()

    fun start() {
        scope.launch { publish() }
    }

    suspend fun publish() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return
        mutex.withLock {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val renderKey = renderKey()
            val manager = GlanceAppWidgetManager(context)
            RECEIVERS.forEach { receiver ->
                publishIfStale(prefs, receiver.java.name, renderKey) {
                    manager.setWidgetPreviews(receiver, intSetOf(AppWidgetProviderInfo.WIDGET_CATEGORY_HOME_SCREEN)) ==
                        GlanceAppWidgetManager.SET_WIDGET_PREVIEWS_RESULT_SUCCESS
                }
            }
        }
    }

    /** What a preview's render depends on: this install of the app, and the locale. */
    private fun renderKey(): String {
        val installed = context.packageManager.getPackageInfo(context.packageName, 0).lastUpdateTime
        return "$installed|${context.resources.configuration.locales.toLanguageTags()}"
    }

    private companion object {
        const val PREFS = "widget_previews"
        val RECEIVERS: List<KClass<out GlanceAppWidgetReceiver>> =
            listOf(TodayWidgetReceiver::class, QuickLogWidgetReceiver::class, HeatmapWidgetReceiver::class)
    }
}

/**
 * Runs [publish] (true on success) unless widget [name]'s preview for [renderKey] is already
 * out, and records a success.
 */
internal suspend fun publishIfStale(prefs: SharedPreferences, name: String, renderKey: String, publish: suspend () -> Boolean) {
    if (prefs.getString(name, null) == renderKey) return
    if (publish()) prefs.edit { putString(name, renderKey) }
}

/**
 * Republishes the previews after an app update (their layouts' resource ids may have changed) or
 * a locale change, which a running process wouldn't otherwise notice.
 */
class WidgetPreviewReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED && intent.action != Intent.ACTION_LOCALE_CHANGED) return
        val previews = context.widgetEntryPoint().previews()
        goAsync { previews.publish() }
    }
}
