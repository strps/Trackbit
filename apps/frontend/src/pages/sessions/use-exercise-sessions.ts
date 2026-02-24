import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    useTracker,
    useUIStore,
    HabitWithLogs,
    OptimisticExerciseSession,
    OptimisticExerciseLog,
    OptimisticExercisePerformance,
} from '@/pages/tracker/use-tracker';

const API_URL = import.meta.env.VITE_API_URL;

const makeUpdateCache =
    (queryClient: ReturnType<typeof useQueryClient>) =>
        (updater: (data: Record<number, HabitWithLogs>) => void) => {
            queryClient.setQueryData(
                ['habit-logs'],
                (old: Record<number, HabitWithLogs> | undefined) => {
                    if (!old) return {};
                    const newData = structuredClone(old);
                    updater(newData);
                    return newData;
                },
            );
        };

export function useExerciseSessions() {
    const queryClient = useQueryClient();
    const updateCache = makeUpdateCache(queryClient);

    const { habitsWithLogs, isLoading } = useTracker();
    const {
        selectedLogId,
        selectedSessionIndex,
        selectLogId: setLogId,
        selectSessionIndex: setSessionIndex,
    } = useUIStore();

    // --- Derived state ---
    // Find day log and parent habit by logId (scanning all habits)
    const { currentHabit, currentDayLog } = useMemo(() => {
        if (selectedLogId != null) {
            for (const habit of Object.values(habitsWithLogs)) {
                for (const dl of Object.values(habit.dayLogs)) {
                    if (dl.id === selectedLogId) {
                        return { currentHabit: habit, currentDayLog: dl };
                    }
                }
            }
        }
        return { currentHabit: undefined, currentDayLog: undefined };
    }, [habitsWithLogs, selectedLogId]);
    const currentSessionIndex = selectedSessionIndex;

    const complexHabits = useMemo(
        () =>
            Object.values(habitsWithLogs)
                .filter((h) => h.type === 'complex')
                .sort((a, b) => {
                    const diff = (a.order ?? 0) - (b.order ?? 0);
                    return diff !== 0 ? diff : a.id - b.id;
                }),
        [habitsWithLogs],
    );

    // --- 1. Create Session ---
    const createSessionMutation = useMutation({
        mutationFn: async (payload?: { dayLogId?: number }) => {
            const dayLogId = payload?.dayLogId ?? currentDayLog?.id;
            if (!dayLogId) throw new Error('No dayLogId available');

            const res = await fetch(`${API_URL}/tracker/exercise-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ dayLogId }),
            });
            if (!res.ok) throw new Error('Failed to create session');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
        },
        onError: (_err, _vars, context: any) => {
            if (context?.previousData) queryClient.setQueryData(['habit-logs'], context.previousData);
        },
    });

    // --- 2. Delete Session ---
    const deleteSessionMutation = useMutation({
        mutationFn: async (sessionId: number) => {
            const res = await fetch(`${API_URL}/tracker/exercise-sessions/${sessionId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete session');
            return res.json();
        },
        onMutate: async (sessionId) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            updateCache((newData) => {
                for (const habit of Object.values(newData)) {
                    for (const dayLog of Object.values(habit.dayLogs)) {
                        if (dayLog.exerciseSessions) {
                            dayLog.exerciseSessions = dayLog.exerciseSessions.filter(
                                (s) => s.id !== sessionId,
                            );
                        }
                    }
                }
            });
            return { previousData };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousData) queryClient.setQueryData(['habit-logs'], context.previousData);
        },
    });

    // --- 3. Add Exercise Log ---
    type AddExerciseLogPayload = {
        exerciseSessionId: number;
        exerciseId: number;
        lastPerformance?: {
            id: number | null;
            weight: number | null;
            reps: number | null;
            distance: number | null;
            duration: number | null;
            createdAt: string | null;
        };
    };
    const addExerciseLogMutation = useMutation({
        mutationFn: async (payload: AddExerciseLogPayload) => {
            const { lastPerformance: _lp, ...serverPayload } = payload;
            const res = await fetch(`${API_URL}/tracker/exercise-logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(serverPayload),
            });
            if (!res.ok) throw new Error('Failed to add exercise log');
            return res.json();
        },
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            // Seed first performance with lastPerformance values when available
            const lp = payload.lastPerformance?.id != null ? payload.lastPerformance : null;
            updateCache((newData) => {
                for (const habit of Object.values(newData)) {
                    for (const dayLog of Object.values(habit.dayLogs)) {
                        const session = dayLog.exerciseSessions?.find(
                            (s) => s.id === payload.exerciseSessionId,
                        );
                        if (session) {
                            const tempLog: OptimisticExerciseLog = {
                                id: -Date.now(),
                                exerciseId: payload.exerciseId,
                                exerciseSessionId: payload.exerciseSessionId,
                                createdAt: null,
                                distance: null,
                                duration: null,
                                distanceUnit: null,
                                weightUnit: null,
                                tempId: `temp-${Date.now()}`,
                                exercisePerformances: [
                                    {
                                        id: -Date.now(),
                                        exerciseLogId: -1,
                                        reps: lp?.reps ?? null,
                                        weight: lp?.weight ?? null,
                                        number: 1,
                                        duration: lp?.duration ?? null,
                                        distance: lp?.distance != null ? String(lp.distance) : null,
                                        createdAt: null,
                                        rpe: null,
                                    },
                                ],
                            };
                            session.exerciseLogs.push(tempLog);
                        }
                    }
                }
            });
            return { previousData };
        },
        onSuccess: (serverLog, payload) => {
            // Replace temp log with real server record
            updateCache((newData) => {
                for (const habit of Object.values(newData)) {
                    for (const dayLog of Object.values(habit.dayLogs)) {
                        const session = dayLog.exerciseSessions?.find(
                            (s) => s.id === payload.exerciseSessionId,
                        );
                        if (session) {
                            const tempIdx = session.exerciseLogs.findIndex((l) => l.id < 0);
                            if (tempIdx !== -1) {
                                session.exerciseLogs[tempIdx] = {
                                    ...session.exerciseLogs[tempIdx],
                                    id: serverLog.id,
                                };
                            }
                        }
                    }
                }
            });
        },
        onError: (_err, _vars, context) => {
            if (context?.previousData) queryClient.setQueryData(['habit-logs'], context.previousData);
        },
    });

    // --- 4. Remove Exercise Log ---
    const removeExerciseLogMutation = useMutation({
        mutationFn: async (logId: number) => {
            const res = await fetch(`${API_URL}/tracker/exercise-logs/${logId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to remove exercise log');
            return res.json();
        },
        onMutate: async (logId) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            updateCache((newData) => {
                for (const habit of Object.values(newData)) {
                    for (const dayLog of Object.values(habit.dayLogs)) {
                        for (const session of dayLog.exerciseSessions ?? []) {
                            session.exerciseLogs = session.exerciseLogs.filter((l) => l.id !== logId);
                        }
                    }
                }
            });
            return { previousData };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousData) queryClient.setQueryData(['habit-logs'], context.previousData);
        },
    });

    // --- 5. New Set ---
    const newSetMutation = useMutation({
        mutationFn: async (payload: { exerciseLog: OptimisticExerciseLog }) => {
            const perfs = payload.exerciseLog.exercisePerformances ?? [];
            const lastPerf = perfs[perfs.length - 1];
            const number = perfs.length + 1;
            const res = await fetch(`${API_URL}/tracker/exercise-performances`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    exerciseLogId: payload.exerciseLog.id,
                    reps: lastPerf?.reps ?? null,
                    weight: lastPerf?.weight ?? null,
                    duration: lastPerf?.duration ?? null,
                    distance: lastPerf?.distance ?? null,
                    rpe: lastPerf?.rpe ?? null,
                    number,
                }),
            });
            if (!res.ok) throw new Error('Failed to create set');
            return res.json();
        },
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            const perfs = payload.exerciseLog.exercisePerformances ?? [];
            const lastPerf = perfs[perfs.length - 1];
            const number = perfs.length + 1;
            updateCache((newData) => {
                for (const habit of Object.values(newData)) {
                    for (const dayLog of Object.values(habit.dayLogs)) {
                        for (const session of dayLog.exerciseSessions ?? []) {
                            const log = session.exerciseLogs.find(
                                (l) => l.id === payload.exerciseLog.id,
                            );
                            if (log) {
                                const tempSet: OptimisticExercisePerformance = {
                                    id: -Date.now(),
                                    exerciseLogId: payload.exerciseLog.id,
                                    reps: lastPerf?.reps ?? null,
                                    weight: lastPerf?.weight ?? null,
                                    number,
                                    duration: lastPerf?.duration ?? null,
                                    distance: lastPerf?.distance ?? null,
                                    createdAt: null,
                                    rpe: lastPerf?.rpe ?? null,
                                    tempId: `temp-${Date.now()}`,
                                };
                                log.exercisePerformances.push(tempSet);
                            }
                        }
                    }
                }
            });
            return { previousData };
        },
        onSuccess: (serverSet, payload) => {
            // Replace temp set with real server record
            updateCache((newData) => {
                for (const habit of Object.values(newData)) {
                    for (const dayLog of Object.values(habit.dayLogs)) {
                        for (const session of dayLog.exerciseSessions ?? []) {
                            const log = session.exerciseLogs.find(
                                (l) => l.id === payload.exerciseLog.id,
                            );
                            if (log) {
                                const tempIdx = log.exercisePerformances.findIndex((p) => p.id < 0);
                                if (tempIdx !== -1) {
                                    log.exercisePerformances[tempIdx] = {
                                        ...log.exercisePerformances[tempIdx],
                                        id: serverSet.id,
                                        tempId: undefined,
                                    };
                                }
                            }
                        }
                    }
                }
            });
        },
        onError: (_err, _vars, context) => {
            if (context?.previousData) queryClient.setQueryData(['habit-logs'], context.previousData);
        },
    });

    // --- 6. Update Set ---
    const updateSetMutation = useMutation({
        mutationFn: async (payload: Partial<OptimisticExercisePerformance> & { id: number }) => {
            const { id, tempId: _tempId, createdAt: _ca, exerciseLogId: _eli, ...rest } = payload;
            // Skip API call for optimistic temp records (negative IDs)
            if (id < 0) return;
            const res = await fetch(`${API_URL}/tracker/exercise-performances/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(rest),
            });
            if (!res.ok) throw new Error('Failed to update set');
            return res.json();
        },
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            updateCache((newData) => {
                for (const habit of Object.values(newData)) {
                    for (const dayLog of Object.values(habit.dayLogs)) {
                        for (const session of dayLog.exerciseSessions ?? []) {
                            for (const log of session.exerciseLogs) {
                                const idx = log.exercisePerformances.findIndex(
                                    (p) => p.id === payload.id,
                                );
                                if (idx !== -1) {
                                    log.exercisePerformances[idx] = {
                                        ...log.exercisePerformances[idx],
                                        ...payload,
                                    };
                                }
                            }
                        }
                    }
                }
            });
            return { previousData };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousData) queryClient.setQueryData(['habit-logs'], context.previousData);
        },
    });

    // --- 7. Delete Set ---
    const deleteSetMutation = useMutation({
        mutationFn: async (setId: number) => {
            const res = await fetch(`${API_URL}/tracker/exercise-performances/${setId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete set');
            return res.json();
        },
        onMutate: async (setId) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            updateCache((newData) => {
                for (const habit of Object.values(newData)) {
                    for (const dayLog of Object.values(habit.dayLogs)) {
                        for (const session of dayLog.exerciseSessions ?? []) {
                            for (const log of session.exerciseLogs) {
                                log.exercisePerformances = log.exercisePerformances.filter(
                                    (p) => p.id !== setId,
                                );
                            }
                        }
                    }
                }
            });
            return { previousData };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousData) queryClient.setQueryData(['habit-logs'], context.previousData);
        },
    });

    return {
        // Data
        habitsWithLogs,
        complexHabits,
        currentHabit,
        currentDayLog,
        isLoading,
        // UI state
        selectedSessionIndex,
        currentSessionIndex,
        setLogId,
        setSessionIndex,
        // Mutations
        createSession: createSessionMutation.mutate,
        deleteSession: deleteSessionMutation.mutate,
        addExerciseLog: addExerciseLogMutation.mutate,
        removeExerciseLog: removeExerciseLogMutation.mutate,
        newSet: newSetMutation.mutate,
        updateSet: updateSetMutation.mutate,
        deleteSet: deleteSetMutation.mutate,
    };
}
