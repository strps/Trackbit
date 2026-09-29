package com.trackbit.widget.action

import android.content.Context
import androidx.glance.GlanceId
import androidx.glance.action.Action
import androidx.glance.action.ActionParameters
import androidx.glance.action.actionParametersOf
import androidx.glance.appwidget.action.ActionCallback
import androidx.glance.appwidget.action.actionRunCallback
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.model.HabitType
import com.trackbit.widget.widgetEntryPoint
import java.time.LocalDate

private val HabitIdKey = ActionParameters.Key<Int>("habitId")
private val DayKey = ActionParameters.Key<String>("day")

/** Identifies the row tapped: its habit and the day it shows, which is the day written to. */
internal fun habitParameters(habit: TrackedHabit): ActionParameters =
    actionParametersOf(HabitIdKey to habit.id, DayKey to habit.day.toString())

/**
 * A tap on a habit row. It writes through [TrackerRepository] (Room + outbox) and never calls the
 * network. The widgets re-render from Room through `WidgetUpdater`. A frozen or deleted habit
 * changes nothing, and its row already shows why.
 */
internal abstract class HabitAction : ActionCallback {
    final override suspend fun onAction(context: Context, glanceId: GlanceId, parameters: ActionParameters) {
        val habitId = requireNotNull(parameters[HabitIdKey]) { "Missing habit id" }
        val day = LocalDate.parse(requireNotNull(parameters[DayKey]) { "Missing day" })
        write(context.widgetEntryPoint().tracker(), habitId, day)
    }

    abstract suspend fun write(tracker: TrackerRepository, habitId: Int, day: LocalDate)
}

/** Check habits: done ↔ not done. */
internal class ToggleHabitAction : HabitAction() {
    override suspend fun write(tracker: TrackerRepository, habitId: Int, day: LocalDate) {
        tracker.toggle(habitId, day)
    }
}

/** Count habits: +1. */
internal class IncrementHabitAction : HabitAction() {
    override suspend fun write(tracker: TrackerRepository, habitId: Int, day: LocalDate) {
        tracker.increment(habitId, day, 1)
    }
}

/**
 * The widget tap that logs [habit] (it writes to the habit's own day), or null for the types
 * that are logged in the app: timers and workout sessions. Frozen habits are the caller's call.
 */
internal fun logAction(habit: TrackedHabit): Action? = when (habit.type) {
    HabitType.Check -> actionRunCallback<ToggleHabitAction>(habitParameters(habit))
    HabitType.Count, HabitType.Negative -> actionRunCallback<IncrementHabitAction>(habitParameters(habit))
    HabitType.Timed, HabitType.Complex, HabitType.Unknown -> null
}
