import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExerciseWithLastPerformance, useExercises } from './use-exercises';
import { create } from 'zustand';
import { Habit, ExerciseSession, ExerciseLog, ExercisePerformance, Exercise } from "@trackbit/types";

const API_URL = import.meta.env.VITE_API_URL;

// --- Optimistic extensions of centralized types ---
export type OptimisticExercisePerformance = ExercisePerformance & { tempId?: string };

export type OptimisticExerciseLog = ExerciseLog & {
    tempId?: string;
    exercisePerformances: OptimisticExercisePerformance[];
};

export type OptimisticExerciseSession = ExerciseSession & {
    exerciseLogs: OptimisticExerciseLog[];
};

interface EnhancedDayLog {
    habitId: number;
    date: string;
    exerciseSessions?: OptimisticExerciseSession[];
    rating?: number;
    notes?: string;
}

interface HabitWithLogs extends Habit {
    dayLogs: Record<string, EnhancedDayLog>;
}

// --- Fetcher ---
const fetchHistory = async (): Promise<Record<number, HabitWithLogs>> => {
    const res = await fetch(`${API_URL}/tracker/history`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch history');
    const data = await res.json();

    const habitsObj: Record<number, HabitWithLogs> = {};

    data.forEach((habit: Habit & { dayLogs?: any[] }) => {
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

export function useTracker() {
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

    //Helper for updating last pperformacne from a exercise
    const updateExerciseLastPerformance = (
        exercise: ExerciseWithLastPerformance,
        reps?: number | null,
        weight?: number | null,
        duration?: number | null,
        distance?: number | null,
    ) => {
        if (reps) exercise.lastPerformance!.reps = reps;
        if (weight) exercise.lastPerformance!.weight = weight;
        if (duration) exercise.lastPerformance!.duration = duration;
        if (distance) exercise.lastPerformance!.distance = distance ?? 0;
    }

    const getCurrentSession = (data: Record<number, HabitWithLogs>): OptimisticExerciseSession | undefined => {
        if (!selectedHabitId || !selectedDay) return undefined;
        return data[selectedHabitId]?.dayLogs?.[selectedDay]?.exerciseSessions?.[selectedSessionIndex];
    };



    // --- Mutations ---

    // 0. Log Simple Habit
    const logSimple = useMutation({
        mutationFn: async (payload: { habitId: number; date: string; rating: number }) => {
            console.log(payload)
            const res = await fetch(`${API_URL}/tracker/check`, {
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
            const res = await fetch(`${API_URL}/tracker/exercise-sessions`, {
                method: 'POST',
                body: JSON.stringify({ habitId: Number(selectedHabitId), date: selectedDay }),
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            return res.json() as Promise<ExerciseSession>;
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
            const res = await fetch(`${API_URL}/tracker/exercise-sessions/${sessionId}`, {
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
            const defaultSet = { reps: exercise.lastPerformance?.reps, weight: exercise.lastPerformance?.weight, number: 1 };
            const res = await fetch(`${API_URL}/tracker/exercise-logs`, {
                method: 'POST',
                body: JSON.stringify({ exerciseSessionId: currentSession.id, exerciseId, exercisePerformances: [defaultSet] }),
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            return res.json() as Promise<ExerciseLog>;
        },
        onMutate: async (exerciseId) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            const tempId = `temp-log-${Math.random()}`;
            const exercise = exercises.find((e) => e.id === exerciseId);
            if (!exercise) throw new Error('Exercise not found');
            const defaultSet = { reps: exercise.lastPerformance?.reps, weight: exercise.lastPerformance?.weight, number: 1, tempId: `temp-set-${Math.random()}` };

            updateCache((newData) => {
                const session = getCurrentSession(newData);
                if (session) {
                    session.exerciseLogs.push({
                        tempId,
                        exerciseId,
                        exercisePerformances: [defaultSet],
                    } as OptimisticExerciseLog);
                }
            });
            return { previousData, tempId };
        },
        onSuccess: (data, _variables, context) => {
            updateCache((newData) => {
                const session = getCurrentSession(newData);
                const log = session?.exerciseLogs.find((l) => 'tempId' in l && l.tempId === context!.tempId);
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
            await fetch(`${API_URL}/tracker/exercise-logs/${exerciseLogId}`, { method: 'DELETE', credentials: 'include' });
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





    //TODO: last reps should be define according to the last set but from the last day
    // Helper to get default reps/weight for an exercise\
    const getExerciseDefaults = (exerciseId: number, exerciseLog?: OptimisticExerciseLog) => {
        const exercise = exercises.find((e) => e.id === exerciseId);

        const number = exerciseLog?.exercisePerformances.length || 0;
        console.log(exerciseLog?.exercisePerformances.length)
        return {
            reps: exercise?.lastPerformance?.reps,
            weight: exercise?.lastPerformance?.weight,
            number: number + 1,
        };
    };

    // 4a. Add a new persisted set
    const createSet = useMutation({
        mutationFn: async ({ exerciseLog }: { exerciseLog: OptimisticExerciseLog }) => {
            if (!exerciseLog.id) throw new Error('Exercise log must have an ID');
            const defaults = getExerciseDefaults(exerciseLog.exerciseId, exerciseLog);
            const payload = {
                exerciseLogId: exerciseLog.id,
                number: defaults.number,
                reps: defaults.reps,
                weight: defaults.weight,
            };

            const res = await fetch(`${API_URL}/tracker/exercise-performances`, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            return res.json() as Promise<ExercisePerformance>;
        },
        onMutate: async ({ exerciseLog }) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);
            const tempSetId = `temp-set-${Math.random()}`;

            updateCache((newData) => {
                const session = getCurrentSession(newData);
                const log = session?.exerciseLogs.find((l) => l.id === exerciseLog.id);
                if (log) {
                    const defaults = getExerciseDefaults(exerciseLog.exerciseId);
                    log.exercisePerformances.push({
                        tempId: tempSetId,
                        reps: defaults.reps,
                        weight: defaults.weight,
                    } as OptimisticExercisePerformance);
                }
            });
            return { previousData, tempSetId };
        },
        onSuccess: (data, _variables, context) => {
            updateCache((newData) => {
                const session = getCurrentSession(newData);
                const set = session?.exerciseLogs
                    .flatMap((l) => l.exercisePerformances)
                    .find((s) => 'tempId' in s && s.tempId === context!.tempSetId);
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
        mutationFn: async (exercisePerformance: OptimisticExercisePerformance) => {

            if (!exercisePerformance.id) throw new Error('Cannot update set without ID');
            const payload = {
                id: Number(exercisePerformance.id),
                number: exercisePerformance.number,
                exerciseLogId: exercisePerformance.exerciseLogId,
                reps: exercisePerformance.reps,
                weight: exercisePerformance.weight,
                duration: exercisePerformance.duration,
                distance: exercisePerformance.distance,
                rpe: exercisePerformance.rpe,
            };

            const res = await fetch(`${API_URL}/tracker/exercise-performances/${exercisePerformance.id}`, {
                method: 'PATCH',
                body: JSON.stringify(payload),
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });

            return res.json() as Promise<ExercisePerformance>;
        },

        onMutate: async (exercisePerformance) => {

            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);

            updateCache((newData) => {
                const log = getCurrentSession(newData)?.exerciseLogs.find((l) => l.id === exercisePerformance.exerciseLogId)
                if (log) {

                    const exercise = exercises.find((e) => e.id === log.exerciseId);

                    updateExerciseLastPerformance(exercise!, exercisePerformance.reps, exercisePerformance.weight);




                    const set = log.exercisePerformances.find((s) => s.id === exercisePerformance.id);

                    if (set) {
                        set.reps = exercisePerformance.reps;
                        set.weight = exercisePerformance.weight;
                    }
                }

            });
            return { previousData };
        },

        onSuccess: (data) => {
            updateCache((newData) => {
                const set = getCurrentSession(newData)?.
                    //TODO: update last perfosmance instead
                    exerciseLogs.find((l) => l.id === data.exerciseLogId)?.
                    exercisePerformances.find((s) => s.id === data.id);
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

    //TODO: this is essential, we need ot update it the last rep or set
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
            await fetch(`${API_URL}/tracker/exercise-performances/${exerciseSetId}`, {
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
                        log.exercisePerformances = log.exercisePerformances.filter((s) => s.id !== exerciseSetId);
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
        newSet: createSet.mutate,
        updateSet: updateSet.mutate,
        deleteSet: deleteSet.mutate,
    };
}
