package strps.dev.trackbit

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import strps.dev.trackbit.feature.auth.SignInScreen
import strps.dev.trackbit.feature.auth.SignInViewModel
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint // Enables Hilt injection on this activity
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    // hiltViewModel() automatically hooks up the injected constructor arguments!
                    val signInViewModel: SignInViewModel = androidx.hilt.navigation.compose.hiltViewModel()

                    SignInScreen(
                        viewModel = signInViewModel,
                        onLoginSuccess = {
                            Log.d("TrackbitAuth", "Login Successful via Hilt Dependency Flow!")
                        }
                    )
                }
            }
        }
    }
}