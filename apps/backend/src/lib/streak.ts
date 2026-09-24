import { addDays } from './user-day.js'

export interface StreakDay {
    rating: number | null
    sessionCount: number
}

export interface StreakHabit {
    type: string
    isAntiHabit: boolean
}

/** Whether a day extends the streak. Mirrors computeStreak in apps/frontend/src/features/tracker/utils.ts. */
export function dayCounts(habit: StreakHabit, log: StreakDay | undefined, day: string, firstLogDay: string | null): boolean {
    if (habit.isAntiHabit) {
        // An anti-habit streak can't reach back before tracking started.
        if (firstLogDay === null || day < firstLogDay) return false
        return !log || (log.rating ?? 0) === 0
    }
    return habit.type === 'complex' ? (log?.sessionCount ?? 0) > 0 : (log?.rating ?? 0) > 0
}

export const MAX_STREAK_DAYS = 365

/** Consecutive counting days ending at (and including) `fromDay`, capped at a year. */
export function streakEndingAt(
    habit: StreakHabit,
    logs: Map<string, StreakDay>,
    fromDay: string,
    firstLogDay: string | null,
): number {
    let streak = 0
    let cursor = fromDay
    while (streak < MAX_STREAK_DAYS && dayCounts(habit, logs.get(cursor), cursor, firstLogDay)) {
        streak++
        cursor = addDays(cursor, -1)
    }
    return streak
}
