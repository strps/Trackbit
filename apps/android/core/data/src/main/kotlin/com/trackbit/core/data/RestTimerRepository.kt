package com.trackbit.core.data

import androidx.room.withTransaction
import com.trackbit.core.database.TrackbitDatabase
import com.trackbit.core.database.entity.TimerEntity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.time.Clock
import java.time.Duration
import java.time.Instant
import javax.inject.Inject

/**
 * The rest countdown between sets, on the timer engine: a `timers` row with no habit and an end
 * instant. [SessionRepository.addSet] starts it; nothing about it reaches the server. Like habit
 * timers, its notification and its end alarm follow Room (they live in `app`).
 */
interface RestTimerRepository {
    /** The running rest timer; null when none runs. It may be over until [finishIfDue] removes it. */
    fun observe(): Flow<RestTimer?>

    /** Moves the end by [ms] (negative: sooner). An end at or before now ends the rest, without an alert. */
    suspend fun adjust(ms: Long)

    /** Ends the rest now, without an alert. */
    suspend fun skip()

    /** For the end alarm: removes the rest timer if it is due, and says whether to alert. */
    suspend fun finishIfDue(): RestEnd
}

/** A rest countdown from [startedAt] to [endsAt]. */
data class RestTimer(val startedAt: Instant, val endsAt: Instant) {
    val totalMs: Long get() = Duration.between(startedAt, endsAt).toMillis()

    fun remainingMs(now: Instant): Long = Duration.between(now, endsAt).toMillis().coerceAtLeast(0)

    fun isOver(now: Instant): Boolean = !now.isBefore(endsAt)

    companion object {
        /** What the −/+ buttons move the end by, in the notification and the session screen. */
        const val STEP_MS = 15_000L
    }
}

enum class RestEnd {
    /** It just ended: alert the user. */
    Ended,

    /** It had ended long ago (the alarm was lost to a reboot, say), so it was removed silently. */
    Stale,

    /** It isn't due yet; the alarm must be set again for its end. */
    NotDue,

    /** None was running. */
    None,
}

internal class DefaultRestTimerRepository @Inject constructor(
    private val db: TrackbitDatabase,
    private val clock: Clock,
) : RestTimerRepository {
    private val timerDao = db.timerDao()

    override fun observe(): Flow<RestTimer?> = timerDao.observeRest().map { it?.toRestTimer() }

    override suspend fun adjust(ms: Long) = db.withTransaction {
        val rest = timerDao.rest() ?: return@withTransaction
        val endsAt = checkNotNull(rest.endsAt).plusMillis(ms)
        if (endsAt.isAfter(clock.instant())) timerDao.setEndsAt(rest.id, endsAt) else timerDao.delete(rest.id)
    }

    override suspend fun skip() = timerDao.deleteRest()

    override suspend fun finishIfDue(): RestEnd = db.withTransaction {
        val rest = timerDao.rest()?.toRestTimer() ?: return@withTransaction RestEnd.None
        val now = clock.instant()
        if (!rest.isOver(now)) return@withTransaction RestEnd.NotDue
        timerDao.deleteRest()
        if (Duration.between(rest.endsAt, now) > ALERT_GRACE) RestEnd.Stale else RestEnd.Ended
    }

    private companion object {
        /** An inexact alarm can be about a minute late; later than this, an alert is only noise. */
        val ALERT_GRACE: Duration = Duration.ofMinutes(2)
    }
}

internal fun TimerEntity.toRestTimer(): RestTimer? = endsAt?.let { RestTimer(startedAt, it) }
