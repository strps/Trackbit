package com.trackbit.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.getValue
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.trackbit.app.navigation.TrackbitNavHost
import com.trackbit.app.timer.TimerNotifier
import com.trackbit.core.designsystem.theme.TrackbitTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

/** An AppCompatActivity for the per-app language ([AppLanguage]) on Android 8–12. */
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {
    private val viewModel: AppViewModel by viewModels()
    @Inject lateinit var timerNotifier: TimerNotifier

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.CREATED) { viewModel.locale.collect(AppLanguage::follow) }
        }
        setContent {
            val authState by viewModel.authState.collectAsStateWithLifecycle()
            TrackbitTheme {
                TrackbitNavHost(
                    authState = authState,
                    onSignOut = viewModel::signOut,
                    onNotificationsAllowed = timerNotifier::onPermissionGranted,
                )
            }
        }
    }
}
