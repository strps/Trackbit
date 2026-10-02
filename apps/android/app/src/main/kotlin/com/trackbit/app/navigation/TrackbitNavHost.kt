package com.trackbit.app.navigation

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import com.trackbit.app.timer.RequestNotificationPermission
import com.trackbit.core.auth.AuthState
import com.trackbit.feature.auth.SignInScreen
import com.trackbit.feature.tracker.TrackerScreen
import kotlinx.serialization.Serializable

/** Screens for a signed-out user. Sign-up and password reset join this graph later. */
@Serializable
data object SignedOutGraph

@Serializable
data object SignInRoute

/** Screens for a signed-in user. */
@Serializable
data object SignedInGraph

@Serializable
data object TrackerRoute

/** A workout habit's session on [day] (ISO date). */
@Serializable
data class SessionRoute(val habitId: Int, val day: String)

/**
 * Routes on [authState]: each auth state owns one graph, and a change of state swaps graphs,
 * clearing the back stack (and its ViewModels), so one user's screens never outlive a sign-out.
 */
@Composable
fun TrackbitNavHost(authState: AuthState, onSignOut: () -> Unit, onNotificationsAllowed: () -> Unit) {
    // Reading the stored session takes a moment at startup; draw nothing rather than guess.
    // Loading never comes back, so the host below is composed once and navigates between graphs.
    if (authState == AuthState.Loading) {
        Surface(Modifier.fillMaxSize()) {}
        return
    }
    AuthNavHost(if (authState is AuthState.SignedIn) SignedInGraph else SignedOutGraph, onSignOut)
    if (authState is AuthState.SignedIn) RequestNotificationPermission(onGranted = onNotificationsAllowed)
}

@Composable
private fun AuthNavHost(graph: Any, onSignOut: () -> Unit) {
    val navController = rememberNavController()
    // Fixed at first composition: a changed start destination would make NavHost reset the
    // graph by itself. Later changes go through [showGraph].
    val startDestination = remember { graph }

    NavHost(navController = navController, startDestination = startDestination) {
        navigation<SignedOutGraph>(startDestination = SignInRoute) {
            composable<SignInRoute> { SignInScreen() }
        }
        navigation<SignedInGraph>(startDestination = TrackerRoute) {
            composable<TrackerRoute> {
                TrackerScreen(
                    onSignOut = onSignOut,
                    onOpenSession = { habitId, day -> navController.navigate(SessionRoute(habitId, day.toString())) },
                )
            }
            composable<SessionRoute> { SessionPlaceholderScreen(onBack = { navController.popBackStack() }) }
        }
    }

    LaunchedEffect(graph) { navController.showGraph(graph) }
}

/** Replaces the whole back stack with [graph], unless it is already showing (e.g. restored). */
private fun NavHostController.showGraph(graph: Any) {
    val current = currentBackStackEntry?.destination ?: return
    if (current.hierarchy.any { it.hasRoute(graph::class) }) return
    navigate(graph) {
        popUpTo(this@showGraph.graph.id) { inclusive = true }
    }
}
