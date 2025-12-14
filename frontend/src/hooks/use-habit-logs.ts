import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useExercises } from './use-exercises';
import { create } from 'zustand';
import { Trackbit } from '../../../types/trackbit'


const API_URL = 'http://localhost:3000/api/logs';

// --- Optimistic extensions of centralized types ---
export type OptimisticExerciseSet = Trackbit.ExerciseSet & { tempId?: string };

type OptimisticExerciseLog = Trackbit.ExerciseLog & {
    tempId?: string;
    exerciseSets: OptimisticExerciseSet[];
};

export type OptimisticExerciseSession = Trackbit.ExerciseSession & {
    exerciseLogs: OptimisticExerciseLog[];
};

interface EnhancedDayLog {
    habitId: number;
    date: string;
    exerciseSessions?: OptimisticExerciseSession[];
    rating?: number;
    notes?: string;
}

interface HabitWithLogs extends Trackbit.Habit {
    dayLogs: Record<string, EnhancedDayLog>;
}

// --- Fetcher ---
const fetchHistory = async (): Promise<Record<number, HabitWithLogs>> => {
    const res = await fetch(`${API_URL}/history`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch history');
    const data = await res.json();

    const habitsObj: Record<number, HabitWithLogs> = {};

    data.forEach((habit: Trackbit.Habit & { dayLogs?: any[] }) => {
        const dayLogsMap: Record<string, EnhancedDayLog> = {};
        if (habit.dayLogs) {
            habit.dayLogs.forEach((dl: any) => {
                dayLogsMap[dl.date] = {
                    habitId: dl.habitId,
                    date: dl.date,
                    exerciseSessions: dl.exerciseSessions || [],
                    rating: dl.rating,
                    notes: dl.notes,
                };
            });
        }
        habitsObj[habit.id] = { ...habit, dayLogs: dayLogsMap };
    });
    return habitsObj;
};

//Store for application State

interface UIState {
    selectedHabitId?: number;
    selectedDay: string;
    selectedSessionIndex: number;
    selectHabitId: (id?: number) => void;
    selectDay: (day: string) => void;
    selectSessionIndex: (i: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
    selectedHabitId: undefined,
    selectedDay: new Date().toISOString().split('T')[0],
    selectedSessionIndex: 0,

    selectHabitId: (id) => set({ selectedHabitId: id }),
    selectDay: (day) => set({ selectedDay: day }),
    selectSessionIndex: (i) => set({ selectedSessionIndex: i }),
}));

export function useHabitLogs() {
    const {
        selectedHabitId,
        selectHabitId,
        selectedDay,
        selectDay,
        selectedSessionIndex,
        selectSessionIndex, } = useUIStore();


    const queryClient = useQueryClient();
    const { exercises } = useExercises();

    // Validate session index (future-proofing)
    if (selectedSessionIndex !== 0) {
        console.warn('Multi-session support not yet implemented; using session index 0');
    }

    const historyQuery = useQuery({
        queryKey: ['habit-logs'],
        queryFn: fetchHistory,
        staleTime: 1000 * 60 * 5,
    });

    const habitsWithLogs = historyQuery.data ?? {};
    const currentDayLog = selectedHabitId && selectedDay
        ? habitsWithLogs[selectedHabitId]?.dayLogs?.[selectedDay]
        : undefined;


    const currentHabit = selectedHabitId
        ? habitsWithLogs[selectedHabitId]
        : undefined;

    const currentSession = currentDayLog?.exerciseSessions?.[selectedSessionIndex];

    // --- Cache helpers ---
    const updateCache = (updater: (data: Record<number, HabitWithLogs>) => void) => {
        queryClient.setQueryData(['habit-logs'], (old: Record<number, HabitWithLogs> | undefined) => {
            if (!old) return {};
            const newData = structuredClone(old);
            updater(newData);
            return newData;
        });
    };

    const getCurrentSession = (data: Record<number, HabitWithLogs>): OptimisticExerciseSession | undefined => {
        if (!selectedHabitId || !selectedDay) return undefined;
        return data[selectedHabitId]?.dayLogs?.[selectedDay]?.exerciseSessions?.[selectedSessionIndex];
    };


    // --- Mutations ---

    // 0. Log Simple Habit
    const logSimple = useMutation({
        mutationFn: async (payload: { habitId: number; date: string; rating: number }) => {
            console.log(payload)
            const res = await fetch(`${API_URL}/check`, {
                method: 'POST',
                body: JSON.stringify({
                    habitId: payload.habitId,
                    date: payload.date,
                    rating: Number(payload.rating),
                }),
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            return res.json();
        },
        onMutate: async (newItem) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            updateCache((newData) => {
                const habit = newData[newItem.habitId];
                if (habit) {
                    if (!habit.dayLogs[newItem.date]) {
                        habit.dayLogs[newItem.date] = {
                            habitId: newItem.habitId,
                            date: newItem.date,
                            exerciseSessions: [],
                        };
                    }
                    habit.dayLogs[newItem.date].rating = newItem.rating;
                }
            });
            return { previousData };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['habit-logs'], context.previousData);
            }
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] }),
    });

    // 1. Create Session
    const createSession = useMutation({
        mutationFn: async () => {
            if (!selectedHabitId || !selectedDay) throw new Error('No context');
            const res = await fetch(`${API_URL}/exercise-sessions`, {
                method: 'POST',
                body: JSON.stringify({ habitId: Number(selectedHabitId), date: selectedDay }),
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            return res.json() as Promise<Trackbit.ExerciseSession>;
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            return { previousData };
        },
        onSuccess: (data) => {
            updateCache((newData) => {
                if (!selectedHabitId || !selectedDay) return;
                const dayLog = newData[selectedHabitId]?.dayLogs[selectedDay];
                if (dayLog) {
                    if (!dayLog.exerciseSessions) dayLog.exerciseSessions = [];
                    dayLog.exerciseSessions.push({ ...data, exerciseLogs: [] });
                } else {
                    newData[selectedHabitId].dayLogs[selectedDay] = {
                        habitId: selectedHabitId,
                        date: selectedDay,
                        exerciseSessions: [{ ...data, exerciseLogs: [] }],
                        rating: 3,
                    };
                }
            });
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['habit-logs'], context.previousData);
            }
        },
    });


    // 6. Delete Exercise Session
    const deleteSession = useMutation({
        mutationFn: async (sessionId: number) => {
            const res = await fetch(`${API_URL}/exercise-sessions/${sessionId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to delete session');
            }
        },
        onMutate: async (sessionId) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);

            updateCache((newData) => {
                const session = getCurrentSession(newData);
                if (session && session.id === sessionId) {
                    const dayLog = newData[selectedHabitId!]?.dayLogs[selectedDay!];
                    if (dayLog?.exerciseSessions) {
                        dayLog.exerciseSessions = dayLog.exerciseSessions.filter(
                            (s) => s.id !== sessionId
                        );
                    }
                }
            });

            return { previousData };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['habit-logs'], context.previousData);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
        },
    });


    // 2. Add Exercise Log
    const addExerciseLog = useMutation({
        mutationFn: async (exerciseId: number) => {
            if (!currentSession?.id) throw new Error('No active session');
            const exercise = exercises.find((e) => e.id === exerciseId);
            if (!exercise) throw new Error('Exercise not found');
            const defaultSet = { reps: exercise.lastSetReps || 10, weight: exercise.lastSetWeight || 25 };
            const res = await fetch(`${API_URL}/exercise-log`, {
                method: 'POST',
                body: JSON.stringify({ sessionId: currentSession.id, exerciseId, exerciseSets: [defaultSet] }),
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            return res.json() as Promise<Trackbit.ExerciseLog>;
        },
        onMutate: async (exerciseId) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            const tempId = `temp-log-${Math.random()}`;
            const exercise = exercises.find((e) => e.id === exerciseId);
            if (!exercise) throw new Error('Exercise not found');
            const defaultSet = { reps: exercise.lastSetReps || 10, weight: exercise.lastSetWeight || 25, tempId: `temp-set-${Math.random()}` };

            updateCache((newData) => {
                const session = getCurrentSession(newData);
                if (session) {
                    session.exerciseLogs.push({
                        tempId,
                        exerciseId,
                        exerciseSets: [defaultSet],
                    } as OptimisticExerciseLog);
                }
            });
            return { previousData, tempId };
        },
        onSuccess: (data, _variables, context) => {
            updateCache((newData) => {
                const session = getCurrentSession(newData);
                const log = session?.exerciseLogs.find((l) => 'tempId' in l && l.tempId === context.tempId);
                if (log) {
                    Object.assign(log, data);
                    delete (log as any).tempId;
                }
            });
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['habit-logs'], context.previousData);
            }
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] }),
    });

    // 3. Remove Exercise Log
    const removeExerciseLog = useMutation({
        mutationFn: async (exerciseLogId: number) => {
            await fetch(`${API_URL}/exercise/${exerciseLogId}`, { method: 'DELETE', credentials: 'include' });
        },
        onMutate: async (exerciseLogId) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            updateCache((newData) => {
                const session = getCurrentSession(newData);
                if (session) {
                    session.exerciseLogs = session.exerciseLogs.filter((l) => l.id !== exerciseLogId);
                }
            });
            return { previousData };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['habit-logs'], context.previousData);
            }
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] }),
    });





    // Helper to get default reps/weight for an exercise
    const getExerciseDefaults = (exerciseId: number) => {
        const exercise = exercises.find((e) => e.id === exerciseId);
        return {
            reps: exercise?.lastSetReps ?? 10,
            weight: exercise?.lastSetWeight ?? 25,
        };
    };

    // 4a. Add a new persisted set
    const newSet = useMutation({
        mutationFn: async (exerciseLog: OptimisticExerciseLog) => {
            if (!exerciseLog.id) throw new Error('Exercise log must have an ID');
            const defaults = getExerciseDefaults(exerciseLog.exerciseId);
            const payload = {
                exerciseLogId: exerciseLog.id,
                reps: defaults.reps,
                weight: defaults.weight,
            };

            const res = await fetch(`${API_URL}/exercise-set`, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            return res.json() as Promise<Trackbit.ExerciseSet>;
        },
        onMutate: async (exerciseLog) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            const tempSetId = `temp-set-${Math.random()}`;

            updateCache((newData) => {
                console.log(exerciseLog)
                const session = getCurrentSession(newData);
                const log = session?.exerciseLogs.find((l) => l.id === exerciseLog.id);
                if (log) {
                    const defaults = getExerciseDefaults(exerciseLog.exerciseId);
                    log.exerciseSets.push({
                        tempId: tempSetId,
                        reps: defaults.reps,
                        weight: defaults.weight,
                    } as OptimisticExerciseSet);
                }
            });
            return { previousData, tempSetId };
        },
        onSuccess: (data, _variables, context) => {
            updateCache((newData) => {
                const session = getCurrentSession(newData);
                const set = session?.exerciseLogs
                    .flatMap((l) => l.exerciseSets)
                    .find((s) => 'tempId' in s && s.tempId === context.tempSetId);
                if (set) {
                    Object.assign(set, data);
                    delete (set as any).tempId;
                }
            });
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['habit-logs'], context.previousData);
            }
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] }),
    });

    // 4b. Update an existing persisted set
    const updateSet = useMutation({
        mutationFn: async (exerciseSet: OptimisticExerciseSet) => {

            if (!exerciseSet.id) throw new Error('Cannot update set without ID');
            const payload = {
                id: Number(exerciseSet.id),
                exerciseLogId: exerciseSet.exerciseLogId,
                reps: exerciseSet.reps,
                weight: exerciseSet.weight,
            };

            const res = await fetch(`${API_URL}/exercise-set`, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });

            return res.json() as Promise<Trackbit.ExerciseSet>;
        },

        onMutate: async (exerciseSet) => {

            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);

            updateCache((newData) => {

                const set = getCurrentSession(newData)?.
                    exerciseLogs.find((l) => l.id === exerciseSet.exerciseLogId)?.
                    exerciseSets.find((s) => s.id === exerciseSet.id);

                if (set) {
                    set.reps = exerciseSet.reps;
                    set.weight = exerciseSet.weight;
                }

            });
            return { previousData };
        },

        onSuccess: (data) => {
            updateCache((newData) => {

                // const session = getCurrentSession(newData);
                // const set = session?.exerciseLogs
                //     .flatMap((l) => l.exerciseSets)
                //     .find((s) => s.id === data.id);

                const set = getCurrentSession(newData)?.
                    exerciseLogs.find((l) => l.id === data.exerciseLogId)?.
                    exerciseSets.find((s) => s.id === data.id);
                if (set) Object.assign(set, data);
            });
        },

        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['habit-logs'], context.previousData);
            }
        },

        onSettled: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] }),

    });

    // 4c. Update only the virtual "last set" defaults (local only)
    // const updateLastSetLocally = useMutation({
    //     mutationFn: (payload: { exerciseId: number; reps: number; weight: number }) => {
    //         // No server call — purely local update to useExercises cache
    //         // Assuming useExercises exposes an update function; adjust as needed
    //         // Example placeholder:
    //         // exercisesStore.updateDefaults(payload.exerciseId, payload.reps, payload.weight);
    //         return payload;
    //     },
    //     onMutate: (payload) => {
    //         // Immediate local update — no cache rollback needed since it's not persisted
    //         // Implement direct update to your exercises cache/store here
    //         console.log('Updating local last set defaults:', payload);
    //         // e.g., queryClient.setQueryData(['exercises'], (old) => updateExercise(old, payload));
    //     },
    // });

    // 5. Delete Set
    const deleteSet = useMutation({
        mutationFn: async (exerciseSetId: number) => {
            await fetch(`${API_URL}/exercise-set/${exerciseSetId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
        },
        onMutate: async (exerciseSetId) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            updateCache((newData) => {
                const session = getCurrentSession(newData);
                if (session) {
                    for (const log of session.exerciseLogs) {
                        log.exerciseSets = log.exerciseSets.filter((s) => s.id !== exerciseSetId);
                    }
                }
            });
            return { previousData };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['habit-logs'], context.previousData);
            }
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] }),
    });

    return {
        habitsWithLogs,
        currentHabit: currentHabit,
        selectedHabitId,
        selectedDay,
        selectedSessionIndex,
        setHabitId: selectHabitId,
        setDay: selectDay,
        setSessionIndex: selectSessionIndex,
        currentDayLog: currentDayLog,
        currentSessionIndex: currentSession,
        isLoading: historyQuery.isLoading,
        logSimple: logSimple.mutate,
        createSession: createSession.mutate,
        deleteSession: deleteSession.mutate,
        addExerciseLog: addExerciseLog.mutate,
        removeExerciseLog: removeExerciseLog.mutate,
        newSet: newSet.mutate,
        updateSet: updateSet.mutate,
        deleteSet: deleteSet.mutate,
    };
}


