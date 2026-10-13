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
 *
 * Past its end it runs on, in overtime, until the next set replaces it, the user ends it, or
 * [RestTimer.OVERTIME] has passed and the alarm removes it.
 */
interface RestTimerRepository {
    /** The running rest timer; null when none runs. It may be in overtime, or expired until [onAlarm] removes it. */
    fun observe(): Flow<RestTimer?>

    /** Moves the end by [ms] (negative: sooner). An end at or before now ends the rest, without an alert; in overtime it does nothing. */
    suspend fun adjust(ms: Long)

    /** Ends the rest now, without an alert. */
    suspend fun skip()

    /** For the alarm (at the end, then at the expiry): removes an expired rest timer, and says what to do. */
    suspend fun onAlarm(): RestEnd
}

/** A rest countdown from [startedAt] to [endsAt], then overtime until [expiresAt]. */
data class RestTimer(val startedAt: Instant, val endsAt: Instant) {
    val totalMs: Long get() = Duration.between(startedAt, endsAt).toMillis()

    /** When the overtime ends and the rest timer goes away. */
    val expiresAt: Instant get() = endsAt.plus(OVERTIME)

    /** The time to [endsAt]; negative in overtime. */
    fun remainingMs(now: Instant): Long = Duration.between(now, endsAt).toMillis()

    fun isOver(now: Instant): Boolean = !now.isBefore(endsAt)

    fun isExpired(now: Instant): Boolean = !now.isBefore(expiresAt)

    companion object {
        /** What the −/+ buttons move the end by, in the notification and the session screen. */
        const val STEP_MS = 15_000L

        /** How long a rest counts on past its end before it goes away by itself. */
        val OVERTIME: Duration = Duration.ofMinutes(15)
    }
}

enum class RestEnd {
    /** It just ended: alert the user. It runs on in overtime; the alarm must be set for its expiry. */
    Ended,

    /** It had ended a while ago (the alarm was late), so it is in overtime without an alert; set the alarm for its expiry. */
    Stale,

    /** Its overtime is over, so it was removed. */
    Expired,

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
        val now = clock.instant()
        val endsAt = checkNotNull(rest.endsAt)
        if (!endsAt.isAfter(now)) return@withTransaction
        val moved = endsAt.plusMillis(ms)
        if (moved.isAfter(now)) timerDao.setEndsAt(rest.id, moved) else timerDao.delete(rest.id)
    }

    override suspend fun skip() = timerDao.deleteRest()

    override suspend fun onAlarm(): RestEnd = db.withTransaction {
        val rest = timerDao.rest()?.toRestTimer() ?: return@withTransaction RestEnd.None
        val now = clock.instant()
        when {
            !rest.isOver(now) -> RestEnd.NotDue
            rest.isExpired(now) -> RestEnd.Expired.also { timerDao.deleteRest() }
            Duration.between(rest.endsAt, now) > ALERT_GRACE -> RestEnd.Stale
            else -> RestEnd.Ended
        }
    }

    private companion object {
        /** An inexact alarm can be about a minute late; later than this, an alert is only noise. */
        val ALERT_GRACE: Duration = Duration.ofMinutes(2)
    }
}

internal fun TimerEntity.toRestTimer(): RestTimer? = endsAt?.let { RestTimer(startedAt, it) }
