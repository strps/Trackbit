package com.trackbit.core.model

import kotlinx.serialization.Serializable

/**
 * `POST /api/habits` and `PUT /api/habits/uuid/:uuid`: every field the habit form edits. The
 * server keeps the order (a create goes last in its group, and so does a change of group) and the
 * description, which the form doesn't show.
 */
@Serializable
data class HabitRequest(
    val name: String,
    val type: HabitType,
    val isAntiHabit: Boolean,
    val weeklyGoal: Int,
    /** Minutes for [HabitType.Timed], times otherwise. */
    val dailyGoal: Int,
    val colorTheme: ColorTheme,
    /** Only shown for [ColorTheme.Custom], but always sent: it's what the custom theme returns to. */
    val colorStops: List<ColorStop>,
    val icon: HabitIcon,
    /** A create's new uuid, which makes a retry return the first habit; null (left out) for an update. */
    val uuid: String? = null,
) {
    init {
        val problems = HabitRules.problems(name, type, isAntiHabit, weeklyGoal, dailyGoal, colorStops)
        require(problems.isEmpty()) { "Invalid habit: $problems" }
    }
}

/** `PATCH /api/habits/reorder`. */
@Serializable
data class HabitReorderRequest(val items: List<HabitOrder>)

/** A habit's place: [order] counts from 0 within its group (habits or anti-habits). */
@Serializable
data class HabitOrder(val uuid: String, val order: Int, val isAntiHabit: Boolean)

/** The habit form's rules, the same the server enforces on create and update. */
object HabitRules {
    val NAME_LENGTH = 3..50
    val WEEKLY_GOAL = 1..7
    /** A count habit's daily goal, as the web's slider offers it. */
    val COUNT_DAILY_GOAL = 1..100
    /** A timed habit's daily goal in minutes: up to a day. */
    val TIMED_DAILY_GOAL = 1..1440

    /** The types the form offers. `negative` is deprecated in favour of [Habit.isAntiHabit]. */
    val FORM_TYPES = listOf(HabitType.Count, HabitType.Check, HabitType.Timed, HabitType.Complex)

    /** A structured session has no slip to count, so it can't be an anti-habit. */
    fun canBeAntiHabit(type: HabitType) = type != HabitType.Complex

    /**
     * The daily goals [type] accepts. A check habit ignores its goal (done is done), so it keeps
     * whatever it had, within what the server accepts.
     */
    fun dailyGoalRange(type: HabitType): IntRange = when (type) {
        HabitType.Timed, HabitType.Check -> TIMED_DAILY_GOAL
        else -> COUNT_DAILY_GOAL
    }

    enum class Problem { NameLength, WeeklyGoal, DailyGoal, AntiHabitType, NoColorStops }

    /** Everything wrong with these values; empty when the server would accept them. */
    fun problems(
        name: String,
        type: HabitType,
        isAntiHabit: Boolean,
        weeklyGoal: Int,
        dailyGoal: Int,
        colorStops: List<ColorStop>,
    ): Set<Problem> = buildSet {
        if (name.trim().length !in NAME_LENGTH) add(Problem.NameLength)
        if (weeklyGoal !in WEEKLY_GOAL) add(Problem.WeeklyGoal)
        if (dailyGoal !in dailyGoalRange(type)) add(Problem.DailyGoal)
        if (isAntiHabit && !canBeAntiHabit(type)) add(Problem.AntiHabitType)
        if (colorStops.isEmpty()) add(Problem.NoColorStops)
    }
}
