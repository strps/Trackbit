package com.trackbit.core.designsystem.theme

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.platform.LocalContext

/** App theme: dynamic color on Android 12+, otherwise the web app's palette. */
@Composable
fun TrackbitTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = true,
    content: @Composable () -> Unit,
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> TrackbitDarkColors
        else -> TrackbitLightColors
    }
    MaterialTheme(colorScheme = colorScheme, content = content)
}

/** The web app's palette as M3 schemes: the fallback without dynamic color, in the app and widgets. */
val TrackbitLightColors: ColorScheme = WebLight.toColorScheme(lightColorScheme())
val TrackbitDarkColors: ColorScheme = WebDark.toColorScheme(darkColorScheme())

/**
 * shadcn's neutral roles onto Material 3's. shadcn's "secondary" is a quiet filled surface, which
 * is M3's secondary *container*; surface containers step from background toward muted, which
 * is lighter than background in dark mode and darker in light mode.
 */
private fun WebPalette.toColorScheme(base: ColorScheme): ColorScheme = base.copy(
    primary = primary,
    onPrimary = primaryForeground,
    primaryContainer = secondary,
    onPrimaryContainer = secondaryForeground,
    inversePrimary = primaryForeground,
    secondary = mutedForeground,
    onSecondary = background,
    secondaryContainer = secondary,
    onSecondaryContainer = secondaryForeground,
    tertiary = primary,
    onTertiary = primaryForeground,
    tertiaryContainer = accent,
    onTertiaryContainer = accentForeground,
    error = destructive,
    onError = background,
    background = background,
    onBackground = foreground,
    surface = background,
    onSurface = foreground,
    surfaceVariant = muted,
    onSurfaceVariant = mutedForeground,
    surfaceTint = primary,
    inverseSurface = foreground,
    inverseOnSurface = background,
    outline = ring,
    outlineVariant = border,
    surfaceBright = background,
    surfaceDim = muted,
    surfaceContainerLowest = background,
    surfaceContainerLow = sidebar,
    surfaceContainer = sidebar,
    surfaceContainerHigh = muted,
    surfaceContainerHighest = muted,
)
