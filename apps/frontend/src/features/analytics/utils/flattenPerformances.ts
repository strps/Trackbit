import type { HabitWithLogs } from '@/features/tracker/use-tracker';
import type { OptimisticExercisePerformance } from '@/features/tracker/use-tracker';

export interface FlatPerformance {
    date: string;
    exerciseId: number;
    sessionId: number;
    logId: number;
    weight: number | null;
    reps: number | null;
    rpe: number | null;
    duration: number | null;
    distance: number | null;
}

/**
 * Flattens all exercise performances from a HabitWithLogs into a single array,
 * sorted chronologically. Skips optimistic (negative id) entries.
 */
export function flattenPerformances(habit: HabitWithLogs): FlatPerformance[] {
    const result: FlatPerformance[] = [];

    for (const [date, dayLog] of Object.entries(habit.dayLogs)) {
        for (const session of dayLog.exerciseSessions ?? []) {
            for (const log of session.exerciseLogs) {
                for (const perf of log.exercisePerformances as OptimisticExercisePerformance[]) {
                    if (perf.id < 0) continue; // skip optimistic
                    result.push({
                        date,
                        exerciseId: log.exerciseId,
                        sessionId: session.id,
                        logId: log.id,
                        weight: perf.weight,
                        reps: perf.reps,
                        rpe: perf.rpe ?? null,
                        duration: perf.duration,
                        distance: perf.distance,
                    });
                }
            }
        }
    }

    return result.sort((a, b) => a.date.localeCompare(b.date));
}