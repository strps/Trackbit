package com.trackbit.app.timer

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.platform.LocalContext
import androidx.core.content.ContextCompat
import androidx.core.content.edit

/**
 * Asks once per install, on Android 13+, for the permission the timer notification needs. Asked
 * in the app after sign-in, since a widget can't ask. Without it timers still run; they just
 * show in the widgets only.
 */
@Composable
fun RequestNotificationPermission(onGranted: () -> Unit) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    val context = LocalContext.current
    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) onGranted()
    }
    LaunchedEffect(Unit) {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
        if (granted || prefs.getBoolean(ASKED, false)) return@LaunchedEffect
        prefs.edit { putBoolean(ASKED, true) }
        launcher.launch(Manifest.permission.POST_NOTIFICATIONS)
    }
}

private const val PREFS = "permissions"
private const val ASKED = "notificationsAsked"
