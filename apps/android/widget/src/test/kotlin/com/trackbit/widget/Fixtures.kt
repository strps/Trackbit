package com.trackbit.widget

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import com.trackbit.core.data.HabitTimer
import com.trackbit.core.data.SyncResult
import com.trackbit.core.data.TrackedHabit
import com.trackbit.core.data.TrackerRepository
import com.trackbit.core.data.WriteResult
import com.trackbit.core.model.ColorStop
import com.trackbit.core.model.ColorTheme
import com.trackbit.core.model.ExerciseLogCardStyle
import com.trackbit.core.model.HabitIcon
import com.trackbit.core.model.HabitProgress
import com.trackbit.core.model.HabitType
import com.trackbit.core.model.RecentDay
import com.trackbit.core.model.Rgba
import com.trackbit.core.model.SessionUser
import com.trackbit.core.model.UnitSystem
import com.trackbit.core.model.HistoryOwner
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import org.robolectric.Shadows.shadowOf
import java.time.LocalDate
import java.util.UUID

val DAY: LocalDate = LocalDate.of(2026, 9, 28)

/** Fixture [n]'s uuid: a real one, since the Today widget folds it into its list's item ids. */
fun habitUuid(n: Int): String = UUID(0, n.toLong()).toString()

fun habit(
    id: Int,
    type: HabitType = HabitType.Count,
    day: LocalDate = DAY,
    value: Long = 0,
    goal: Long = 2,
    isAntiHabit: Boolean = false,
    frozen: Boolean = false,
    streak: Int? = 0,
    timer: HabitTimer? = null,
) = TrackedHabit(
    uuid = habitUuid(id),
    name = "Habit $id",
    description = null,
    type = type,
    isAntiHabit = isAntiHabit,
    icon = HabitIcon.Water,
    colorTheme = ColorTheme.Green,
    colorStops = listOf(ColorStop(0f, Rgba(0f, 128f, 0f)), ColorStop(1f, Rgba(0f, 255f, 0f))),
    dailyGoal = goal.toInt(),
    weeklyGoal = 5,
    frozen = frozen,
    day = day,
    recent = listOf(RecentDay(day, rating = value.toInt(), sessionCount = 0)),
    progress = HabitProgress(value = value, goal = goal, isAntiHabit = isAntiHabit),
    streak = streak,
    timer = timer,
)

fun user(id: String = "u_1") = SessionUser(
    id = id,
    name = "cj",
    email = "$id@test.local",
    emailVerified = true,
    image = null,
    role = "tester",
    locale = "en",
    timezone = "America/Costa_Rica",
    unitSystem = UnitSystem.Metric,
    exerciseLogCardStyle = ExerciseLogCardStyle.Compact,
    preferredExerciseSource = null,
)

/**
 * Registers the app's launcher activity, which `openAppAction` needs (the widget module has no
 * activity of its own), and returns its launch intent.
 */
fun registerLauncherActivity(context: Context): Intent {
    val main = ComponentName(context, "com.trackbit.app.MainActivity")
    shadowOf(context.packageManager).apply {
        addActivityIfNotPresent(main)
        addIntentFilterForActivity(main, IntentFilter(Intent.ACTION_MAIN).apply { addCategory(Intent.CATEGORY_LAUNCHER) })
    }
    return context.packageManager.getLaunchIntentForPackage(context.packageName)!!
}

/** Habits per day; only what the widgets read. */
class FakeTrackerRepository : TrackerRepository {
    val days = MutableStateFlow<Map<LocalDate, List<TrackedHabit>>>(emptyMap())
    override val changes = MutableSharedFlow<Unit>()
    override val pendingWrites = MutableStateFlow(0)

    override fun observeDay(day: LocalDate, days: Int): Flow<List<TrackedHabit>> = this.days.map { it[day].orEmpty() }

    override fun observeHabit(habitUuid: String, day: LocalDate, days: Int): Flow<TrackedHabit?> {
        observed += Triple(habitUuid, day, days)
        return this.days.map { byDay -> byDay[day]?.find { it.uuid == habitUuid } }
    }

    /** Every [observeHabit] call: habit, day and how many days. */
    val observed = mutableListOf<Triple<String, LocalDate, Int>>()
    val historyRequests = mutableListOf<Pair<HistoryOwner, LocalDate>>()
    val historyReleases = mutableListOf<HistoryOwner>()

    override suspend fun requestHistory(owner: HistoryOwner, start: LocalDate) { historyRequests += owner to start }
    override suspend fun releaseHistory(owner: HistoryOwner) { historyReleases += owner }

    override suspend fun setRating(habitUuid: String, day: LocalDate, rating: Int) = unused()
    override suspend fun increment(habitUuid: String, day: LocalDate, delta: Int) = unused()
    override suspend fun toggle(habitUuid: String, day: LocalDate) = unused()
    override suspend fun ensureDayLog(habitUuid: String, day: LocalDate) = unused()
    override fun observeRunningTimers(): Flow<List<TrackedHabit>> = throw UnsupportedOperationException()
    override suspend fun startTimer(habitUuid: String, day: LocalDate) = unused()
    override suspend fun stopTimer(habitUuid: String) = unused()
    override suspend fun addToTimer(habitUuid: String, ms: Long) = unused()
    override suspend fun refresh(): SyncResult = throw UnsupportedOperationException()

    private fun unused(): WriteResult = throw UnsupportedOperationException()
}
