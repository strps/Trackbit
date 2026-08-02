import { useMemo, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    useTracker,
    HabitWithLogs,
    OptimisticExerciseLog,
    OptimisticExercisePerformance,
} from '@/features/tracker/use-tracker';
import { useActivityTrackerStore } from '../store/activityTrackerStore';
import { useExercises } from '@/hooks/use-exercises';
import { ApiError, parseApiError } from '@/shared/lib/api-error';
import { toast } from 'sonner';
import i18next from 'i18next';

const toastFrozenError = (err: unknown) => {
    if (!(err instanceof ApiError)) return;
    if (err.code === 'habit_frozen') {
        toast.error(i18next.t('errors:limits.habit_frozen_title'), {
            description: i18next.t('errors:limits.habit_frozen_body'),
        });
    } else if (err.code === 'custom_exercise_frozen') {
        toast.error(i18next.t('errors:limits.custom_exercise_frozen_title'), {
            description: i18next.t('errors:limits.custom_exercise_frozen_body'),
        });
    }
};

const API_URL = import.meta.env.VITE_API_URL;

// ---------------------------------------------------------------------------
// Cache helper — scoped to the habit-logs query key
// ---------------------------------------------------------------------------
const makeUpdateCache =
    (queryClient: ReturnType<typeof useQueryClient>) =>
        (updater: (data: Record<number, HabitWithLogs>) => void) => {
            queryClient.setQueryData(
                ['habit-logs'],
                (old: Record<number, HabitWithLogs> | undefined) => {
                    if (!old) return {};
                    const next = structuredClone(old);
                    updater(next);
                    return next;
                },
            );
        };

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useActivityTracker() {
    const queryClient = useQueryClient();
    const updateCache = makeUpdateCache(queryClient);

    const { habitsWithLogs, isLoading } = useTracker();
    const { exercises, updateLastPerformance } = useExercises();

    const { selectedLogId: dayLogId, selectedSessionIndex, selectSessionIndex: setSessionIndex } =
        useActivityTrackerStore();

    // -------------------------------------------------------------------------
    // Derived state — find the habit + dayLog that owns this dayLogId
    // -------------------------------------------------------------------------
    const { currentHabit, currentDayLog } = useMemo(() => {
        for (const habit of Object.values(habitsWithLogs)) {
            for (const dl of Object.values(habit.dayLogs)) {
                if (dl.id === dayLogId) {
                    return { currentHabit: habit, currentDayLog: dl };
                }
            }
        }
        return { currentHabit: undefined, currentDayLog: undefined };
    }, [habitsWithLogs, dayLogId]);

    const sessions = currentDayLog?.exerciseSessions ?? [];
    const currentSession = sessions[selectedSessionIndex] ?? null;

    // -------------------------------------------------------------------------
    // Lookup helpers — scoped to currentDayLog for efficiency
    // -------------------------------------------------------------------------
    const getExerciseIdFromLogId = useCallback(
        (logId: number): number | undefined => {
            for (const session of currentDayLog?.exerciseSessions ?? []) {
                const log = session.exerciseLogs.find((l) => l.id === logId);
                if (log) return log.exerciseId;
            }
            return undefined;
        },
        [currentDayLog],
    );

    const getExerciseIdFromPerformanceId = useCallback(
        (performanceId: number): number | undefined => {
            for (const session of currentDayLog?.exerciseSessions ?? []) {
                for (const log of session.exerciseLogs) {
                    if (log.exercisePerformances.some((p) => p.id === performanceId)) {
                        return log.exerciseId;
                    }
                }
            }
            return undefined;
        },
        [currentDayLog],
    );

    const getCurrentPerformanceCount = useCallback(
        (logId: number): number => {
            for (const session of currentDayLog?.exerciseSessions ?? []) {
                const log = session.exerciseLogs.find((l) => l.id === logId);
                if (log) return log.exercisePerformances?.length ?? 0;
            }
            return 0;
        },
        [currentDayLog],
    );

    const findLastPerformance = useCallback(
        (exerciseId?: number) => {
            if (!exerciseId) return undefined;
            return exercises.find((ex) => ex.id === exerciseId)?.lastPerformance;
        },
        [exercises],
    );

    // -------------------------------------------------------------------------
    // 1. Create Session
    // -------------------------------------------------------------------------
    const createSessionMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`${API_URL}/tracker/exercise-sessions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ dayLogId }),
            });
            if (!res.ok) throw await parseApiError(res, 'Failed to create session');
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] }),
        onError: toastFrozenError,
    });

    // -------------------------------------------------------------------------
    // 2. Delete Session
    // -------------------------------------------------------------------------
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
            updateCache((next) => {
                for (const habit of Object.values(next)) {
                    for (const dl of Object.values(habit.dayLogs)) {
                        if (dl.exerciseSessions) {
                            dl.exerciseSessions = dl.exerciseSessions.filter((s) => s.id !== sessionId);
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

    // -------------------------------------------------------------------------
    // 3. Add Exercise Log
    // -------------------------------------------------------------------------
    const addExerciseLogMutation = useMutation({
        // listItemId carries provenance when the log came from a source queue.
        mutationFn: async (payload: { exerciseSessionId: number; exerciseId: number; listItemId?: number | null }) => {
            const res = await fetch(`${API_URL}/tracker/exercise-logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw await parseApiError(res, 'Failed to add exercise log');
            return res.json();
        },
        onMutate: async (payload) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            updateCache((next) => {
                for (const habit of Object.values(next)) {
                    for (const dl of Object.values(habit.dayLogs)) {
                        const session = dl.exerciseSessions?.find(
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
                                listItemId: payload.listItemId ?? null,
                                tempId: `temp-${Date.now()}`,
                                exercisePerformances: [],
                            };
                            session.exerciseLogs.push(tempLog);
                        }
                    }
                }
            });
            return { previousData };
        },
        onSuccess: (serverLog, payload) => {
            updateCache((next) => {
                for (const habit of Object.values(next)) {
                    for (const dl of Object.values(habit.dayLogs)) {
                        const session = dl.exerciseSessions?.find(
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
        onError: (err, _vars, context) => {
            if (context?.previousData) queryClient.setQueryData(['habit-logs'], context.previousData);
            toastFrozenError(err);
        },
    });

    // -------------------------------------------------------------------------
    // 4. Remove Exercise Log
    // -------------------------------------------------------------------------
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
            updateCache((next) => {
                for (const habit of Object.values(next)) {
                    for (const dl of Object.values(habit.dayLogs)) {
                        for (const session of dl.exerciseSessions ?? []) {
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

    // -------------------------------------------------------------------------
    // 5. New Performance
    // -------------------------------------------------------------------------
    const newPerformanceMutation = useMutation({
        mutationFn: async ({ exerciseLogId }: { exerciseLogId: number }) => {
            const exerciseId = getExerciseIdFromLogId(exerciseLogId);
            if (!exerciseId) throw new Error('Exercise not found for log');

            const lastPerf = findLastPerformance(exerciseId);
            const number = getCurrentPerformanceCount(exerciseLogId) + 1;

            const res = await fetch(`${API_URL}/tracker/exercise-performances`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    exerciseLogId,
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
        onMutate: async ({ exerciseLogId }) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);

            const exerciseId = getExerciseIdFromLogId(exerciseLogId);
            const lastPerf = findLastPerformance(exerciseId);
            const number = getCurrentPerformanceCount(exerciseLogId) + 1;

            updateCache((next) => {
                for (const habit of Object.values(next)) {
                    for (const dl of Object.values(habit.dayLogs)) {
                        for (const session of dl.exerciseSessions ?? []) {
                            const log = session.exerciseLogs.find((l) => l.id === exerciseLogId);
                            if (log) {
                                const tempSet: OptimisticExercisePerformance = {
                                    id: -Date.now(),
                                    exerciseLogId,
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
            return { previousData, exerciseId };
        },
        onSuccess: (serverSet, { exerciseLogId }, context) => {
            updateCache((next) => {
                for (const habit of Object.values(next)) {
                    for (const dl of Object.values(habit.dayLogs)) {
                        for (const session of dl.exerciseSessions ?? []) {
                            const log = session.exerciseLogs.find((l) => l.id === exerciseLogId);
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

            if (context?.exerciseId && serverSet) {
                updateLastPerformance({
                    exerciseId: context.exerciseId,
                    lastPerformance: {
                        id: serverSet.id,
                        weight: serverSet.weight ?? null,
                        reps: serverSet.reps ?? null,
                        distance: serverSet.distance ?? null,
                        duration: serverSet.duration ?? null,
                        rpe: serverSet.rpe ?? null,
                        createdAt: serverSet.createdAt || new Date().toISOString(),
                    },
                });
            }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousData) queryClient.setQueryData(['habit-logs'], context.previousData);
        },
    });

    // -------------------------------------------------------------------------
    // 6. Update Performance
    // -------------------------------------------------------------------------
    const updatePerformanceMutation = useMutation({
        mutationFn: async (payload: Partial<OptimisticExercisePerformance> & { id: number }) => {
            const { id, tempId: _tempId, createdAt: _ca, exerciseLogId: _eli, ...rest } = payload;
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
            const exerciseId = getExerciseIdFromPerformanceId(payload.id);

            updateCache((next) => {
                for (const habit of Object.values(next)) {
                    for (const dl of Object.values(habit.dayLogs)) {
                        for (const session of dl.exerciseSessions ?? []) {
                            for (const log of session.exerciseLogs) {
                                const idx = log.exercisePerformances.findIndex((p) => p.id === payload.id);
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
            return { previousData, exerciseId };
        },
        onSuccess: (serverSet, payload, context) => {
            updateCache((next) => {
                for (const habit of Object.values(next)) {
                    for (const dl of Object.values(habit.dayLogs)) {
                        for (const session of dl.exerciseSessions ?? []) {
                            for (const log of session.exerciseLogs) {
                                const idx = log.exercisePerformances.findIndex((p) => p.id === payload.id);
                                if (idx !== -1 && serverSet) {
                                    log.exercisePerformances[idx] = {
                                        ...log.exercisePerformances[idx],
                                        ...serverSet,
                                    };
                                }
                            }
                        }
                    }
                }
            });

            if (context?.exerciseId && serverSet) {
                updateLastPerformance({
                    exerciseId: context.exerciseId,
                    lastPerformance: {
                        id: serverSet.id,
                        weight: serverSet.weight ?? null,
                        reps: serverSet.reps ?? null,
                        distance: serverSet.distance ?? null,
                        duration: serverSet.duration ?? null,
                        rpe: serverSet.rpe ?? null,
                        createdAt: serverSet.createdAt || new Date().toISOString(),
                    },
                });
            }
        },
        onError: (_err, _vars, context) => {
            if (context?.previousData) queryClient.setQueryData(['habit-logs'], context.previousData);
        },
    });

    // -------------------------------------------------------------------------
    // 7. Delete Performance
    // -------------------------------------------------------------------------
    const deletePerformanceMutation = useMutation({
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
            updateCache((next) => {
                for (const habit of Object.values(next)) {
                    for (const dl of Object.values(habit.dayLogs)) {
                        for (const session of dl.exerciseSessions ?? []) {
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

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------
    return {
        // Data
        isLoading,
        habitName: currentHabit?.name,
        currentDayLog,
        sessions,
        currentSession,
        sessionIndex: selectedSessionIndex,

        // Session index navigation (Zustand)
        setSessionIndex,

        // Mutations
        createSession: createSessionMutation.mutate,
        deleteSession: deleteSessionMutation.mutate,
        addExerciseLog: addExerciseLogMutation.mutate,
        removeExerciseLog: removeExerciseLogMutation.mutate,
        newPerformance: newPerformanceMutation.mutate,
        updatePerformance: updatePerformanceMutation.mutate,
        deletePerformance: deletePerformanceMutation.mutate,
    };
}