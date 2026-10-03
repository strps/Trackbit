package com.trackbit.app.navigation

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import com.trackbit.app.timer.RequestNotificationPermission
import com.trackbit.core.auth.AuthState
import com.trackbit.core.designsystem.icon.UiIcons
import com.trackbit.core.i18n.R
import com.trackbit.feature.account.SettingsScreen
import com.trackbit.feature.analytics.AnalyticsScreen
import com.trackbit.feature.auth.SignInScreen
import com.trackbit.feature.habitsconfig.HabitFormScreen
import com.trackbit.feature.habitsconfig.HabitsConfigScreen
import com.trackbit.feature.session.SessionScreen
import com.trackbit.feature.tracker.TrackerScreen
import kotlinx.serialization.Serializable
import java.time.LocalDate

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

@Serializable
data object AnalyticsRoute

/** The configuration screens and the account, like the web's config links and user menu. */
@Serializable
data object SettingsRoute

@Serializable
data object HabitsConfigRoute

/** The habit form; [habitId] null creates one. The name matches `HabitFormViewModel.HABIT_ID`. */
@Serializable
data class HabitFormRoute(val habitId: Int? = null)

/** The signed-in screens the bottom bar switches between, like the web's header links. */
private enum class TopLevel(val route: Any, @StringRes val label: Int, @DrawableRes val icon: Int) {
    Tracker(TrackerRoute, R.string.nav_tracker, UiIcons.Flame),
    Stats(AnalyticsRoute, R.string.nav_stats, UiIcons.BarChart),
    Settings(SettingsRoute, R.string.nav_settings, UiIcons.Settings),
}

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

    val destination = navController.currentBackStackEntryAsState().value?.destination
    val current = destination?.let { d -> TopLevel.entries.find { d.hasRoute(it.route::class) } }

    Scaffold(
        bottomBar = { if (current != null) TopLevelBar(current) { navController.showTopLevel(it) } },
        // Each screen's own Scaffold handles the insets; this one only makes room for the bar.
        contentWindowInsets = WindowInsets(0),
    ) { padding ->
        NavHost(
            navController = navController,
            startDestination = startDestination,
            modifier = Modifier.padding(padding).consumeWindowInsets(padding),
        ) {
            navigation<SignedOutGraph>(startDestination = SignInRoute) {
                composable<SignInRoute> { SignInScreen() }
            }
            navigation<SignedInGraph>(startDestination = TrackerRoute) {
                composable<TrackerRoute> {
                    TrackerScreen(
                        onOpenSession = { habitId, day -> navController.navigate(SessionRoute(habitId, day.toString())) },
                    )
                }
                composable<AnalyticsRoute> { AnalyticsScreen() }
                composable<SettingsRoute> {
                    SettingsScreen(onOpenHabits = { navController.navigate(HabitsConfigRoute) }, onSignOut = onSignOut)
                }
                composable<HabitsConfigRoute> {
                    HabitsConfigScreen(
                        onBack = { navController.popBackStack() },
                        onAdd = { navController.navigate(HabitFormRoute()) },
                        onEdit = { navController.navigate(HabitFormRoute(it)) },
                    )
                }
                composable<HabitFormRoute> { HabitFormScreen(onDone = { navController.popBackStack() }) }
                composable<SessionRoute> { entry ->
                    val route = entry.toRoute<SessionRoute>()
                    SessionScreen(route.habitId, LocalDate.parse(route.day), onBack = { navController.popBackStack() })
                }
            }
        }
    }

    LaunchedEffect(graph) { navController.showGraph(graph) }
}

@Composable
private fun TopLevelBar(current: TopLevel, onSelect: (TopLevel) -> Unit) {
    NavigationBar {
        for (item in TopLevel.entries) {
            NavigationBarItem(
                selected = item == current,
                onClick = { if (item != current) onSelect(item) },
                icon = { Icon(painterResource(item.icon), contentDescription = null) },
                label = { Text(stringResource(item.label)) },
            )
        }
    }
}

/**
 * Switches tabs the usual way: one entry per tab above the tracker, each tab's screen state
 * saved and restored, so Back from Stats returns to the tracker.
 */
private fun NavHostController.showTopLevel(item: TopLevel) {
    navigate(item.route) {
        popUpTo<TrackerRoute> { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

/** Replaces the whole back stack with [graph], unless it is already showing (e.g. restored). */
private fun NavHostController.showGraph(graph: Any) {
    val current = currentBackStackEntry?.destination ?: return
    if (current.hierarchy.any { it.hasRoute(graph::class) }) return
    navigate(graph) {
        popUpTo(this@showGraph.graph.id) { inclusive = true }
    }
}
