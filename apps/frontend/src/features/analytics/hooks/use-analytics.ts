import { useMemo } from 'react';
import { useTracker, useUIStore, type HabitWithLogs } from '@/features/tracker/use-tracker';
import type { OptimisticExerciseSession } from '@/features/tracker/use-tracker';
import { computeStreak } from '@/features/tracker/utils';
import { differenceInDays, format } from 'date-fns';

export interface AnalyticsStats {
    totalCompletions: number;
    currentStreak: number;
    goalFrequency: string;
}

export function useAnalytics() {
    const { habitsWithLogs, isLoading } = useTracker();
    const {
        selectedHabitId,
        selectedDay,
        selectDay: setDay,
        selectHabitId: setHabitId,
    } = useUIStore();

    // --- Derived state ---
    const currentHabit = selectedHabitId ? habitsWithLogs[selectedHabitId] : undefined;

    const sortedHabits = useMemo(
        () =>
            Object.values(habitsWithLogs).sort((a, b) => {
                const diff = (a.order ?? 0) - (b.order ?? 0);
                return diff !== 0 ? diff : a.id - b.id;
            }),
        [habitsWithLogs],
    );

    // --- Heatmap rating getter ---
    const getRating = useMemo(() => {
        const logsMap = currentHabit?.dayLogs;
        return (date: string): number => {
            if (!logsMap) return 0;
            return currentHabit?.type === 'complex'
                ? logsMap[date]?.exerciseSessions?.reduce(
                    (a: number, c: OptimisticExerciseSession) => a + (c.exerciseLogs?.length || 0), 0) || 0
                : logsMap[date]?.rating || 0;
        };
    }, [currentHabit]);

    // --- Stats ---
    const stats = useMemo((): AnalyticsStats => {
        const dayLogs = currentHabit?.dayLogs ?? {};
        const loggedDates = Object.keys(dayLogs).sort().reverse();

        // Total completions
        const totalCompletions = loggedDates.filter((date) => {
            const log = dayLogs[date];
            return log.rating !== undefined || (log.exerciseSessions && log.exerciseSessions.length > 0);
        }).length;

        // Current streak
        const currentStreak = currentHabit
            ? computeStreak(dayLogs, format(new Date(), 'yyyy-MM-dd'), currentHabit.type, currentHabit.isAntiHabit)
            : 0;

        // Goal frequency
        let goalFrequency = '0%';
        if (currentHabit && loggedDates.length > 0) {
            const startDateStr = loggedDates[loggedDates.length - 1];
            const startDate = new Date(startDateStr);
            const endDate = new Date();
            const totalDays = differenceInDays(endDate, startDate) + 1;
            goalFrequency = totalDays > 0
                ? `${Math.round((totalCompletions / totalDays) * 100)}%`
                : '0%';
        }

        return { totalCompletions, currentStreak, goalFrequency };
    }, [currentHabit]);

    return {
        // Data
        habitsWithLogs,
        sortedHabits,
        currentHabit,
        isLoading,
        // UI state
        selectedHabitId,
        selectedDay,
        setDay,
        setHabitId,
        // Computed
        getRating,
        stats,
    };
}
