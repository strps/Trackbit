import { useMemo } from 'react';
import { useTracker } from '@/pages/tracker/use-tracker';

/**
 * Convenience hook that wraps useTracker and exposes only
 * exercise-session-related state & mutations.
 *
 * It also provides a filtered list of "complex" habits (the ones
 * that use structured exercise sessions) sorted by order.
 */
export function useExerciseSessions() {
    const {
        habitsWithLogs,
        currentHabit,
        selectedHabitId,
        selectedDay,
        selectedSessionIndex,
        setHabitId,
        setDay,
        setSessionIndex,
        currentDayLog,
        currentSessionIndex,
        isLoading,
        createSession,
        deleteSession,
        addExerciseLog,
        removeExerciseLog,
        newSet,
        updateSet,
        deleteSet,
    } = useTracker();

    // Only complex habits have exercise sessions
    const complexHabits = useMemo(() => {
        return Object.values(habitsWithLogs)
            .filter((h) => h.type === 'complex')
            .sort((a, b) => {
                const orderDiff = (a.order ?? 0) - (b.order ?? 0);
                return orderDiff !== 0 ? orderDiff : a.id - b.id;
            });
    }, [habitsWithLogs]);

    return {
        complexHabits,
        currentHabit,
        selectedHabitId,
        selectedDay,
        selectedSessionIndex,
        setHabitId,
        setDay,
        setSessionIndex,
        currentDayLog,
        currentSessionIndex,
        isLoading,
        createSession,
        deleteSession,
        addExerciseLog,
        removeExerciseLog,
        newSet,
        updateSet,
        deleteSet,
    };
}
