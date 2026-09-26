package com.trackbit.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import androidx.compose.runtime.getValue
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.trackbit.app.navigation.TrackbitNavHost
import com.trackbit.core.designsystem.theme.TrackbitTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    private val viewModel: AppViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            val authState by viewModel.authState.collectAsStateWithLifecycle()
            TrackbitTheme {
                TrackbitNavHost(authState = authState, onSignOut = viewModel::signOut)
            }
        }
    }
}
