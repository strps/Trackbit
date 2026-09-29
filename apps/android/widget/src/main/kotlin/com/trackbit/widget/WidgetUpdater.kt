package com.trackbit.widget

import android.content.Context
import com.trackbit.core.auth.AuthRepository
import com.trackbit.core.auth.AuthState
import com.trackbit.core.data.TrackerRepository
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.conflate
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.filterNot
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.merge
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Re-renders every widget when what they show may have changed: tracker data (a write from the
 * app or a widget, a sync) or the session. A widget collects its data only while its Glance
 * session lives, about 45 seconds after the last update, so without this a sync or an app write
 * would reach it only on the launcher's next request. Call [start] once, from
 * `Application.onCreate`.
 */
@Singleton
class WidgetUpdater @Inject internal constructor(
    @ApplicationContext private val context: Context,
    private val tracker: TrackerRepository,
    private val auth: AuthRepository,
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    fun start() {
        scope.launch {
            widgetRefreshes(tracker.changes, auth.state).collect { TrackbitWidgets.updateAll(context) }
        }
    }
}

/**
 * One emission per change worth a re-render. The first known auth state counts too: a process
 * that died between clearing Room and updating the widgets would otherwise leave them showing
 * the previous user's habits.
 */
internal fun widgetRefreshes(changes: Flow<Unit>, auth: Flow<AuthState>): Flow<Unit> = merge(
    changes,
    auth.filterNot { it is AuthState.Loading }.distinctUntilChanged().map { },
).conflate()
