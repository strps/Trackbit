package com.trackbit.widget.ui

import android.content.Context
import android.os.Build
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.Action
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.appWidgetBackground
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.color.ColorProviders
import androidx.glance.color.DynamicThemeColorProviders
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.padding
import androidx.glance.material3.ColorProviders
import androidx.glance.text.Text
import androidx.glance.text.TextAlign
import androidx.glance.text.TextStyle
import com.trackbit.core.designsystem.theme.TrackbitDarkColors
import com.trackbit.core.designsystem.theme.TrackbitLightColors

private val TrackbitColors: ColorProviders = ColorProviders(light = TrackbitLightColors, dark = TrackbitDarkColors)

/** Like the app's theme: the wallpaper's colors on Android 12+, otherwise the web palette. */
@Composable
internal fun WidgetTheme(content: @Composable () -> Unit) {
    val colors = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) DynamicThemeColorProviders else TrackbitColors
    GlanceTheme(colors = colors, content = content)
}

/** The widget's surface: themed background, the launcher's corner radius, padding. */
@Composable
internal fun WidgetSurface(
    horizontalPadding: Dp = 12.dp,
    verticalPadding: Dp = 10.dp,
    content: @Composable () -> Unit,
) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .appWidgetBackground()
            .background(GlanceTheme.colors.widgetBackground)
            .launcherCornerRadius()
            .padding(horizontal = horizontalPadding, vertical = verticalPadding),
    ) { content() }
}

/** Android 12+ publishes the launcher's widget corner radius; older launchers show widgets square. */
private fun GlanceModifier.launcherCornerRadius(): GlanceModifier =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        cornerRadius(android.R.dimen.system_app_widget_background_radius)
    } else {
        this
    }

/** A centered message that opens the app, for the signed-out and empty states. */
@Composable
internal fun WidgetMessage(text: String, onClick: Action) {
    Box(
        modifier = GlanceModifier.fillMaxSize().clickable(onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            style = TextStyle(color = GlanceTheme.colors.onSurfaceVariant, fontSize = 14.sp, textAlign = TextAlign.Center),
        )
    }
}

/**
 * Opens the app on its start screen. By launch intent rather than by class, because widgets
 * don't depend on `app`.
 */
internal fun openAppAction(context: Context): Action = actionStartActivity(
    requireNotNull(context.packageManager.getLaunchIntentForPackage(context.packageName)) {
        "The app has no launcher activity"
    },
)
