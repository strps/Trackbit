import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { Habit, ExerciseSession, ExerciseLog, ExercisePerformance } from "@trackbit/types";
import { DateTime } from 'luxon';
import { GRADIENT_PRESETS } from '@/features/habits-configuration/ColorThemeField';

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

interface EnhancedDayLog { //TODO: use trackbit types
    id?: number;
    habitId: number;
    date: string;
    createdAt?: string;
    exerciseSessions?: OptimisticExerciseSession[];
    timeStamp?: string;
    rating?: number;
    notes?: string;
    localDay?: string;
}
type DayLogs = Record<string, EnhancedDayLog>
export interface HabitWithLogs extends Habit {
    dayLogs: DayLogs
}

// --- Fetcher ---
const fetchHistory = async (): Promise<Record<number, HabitWithLogs>> => {
    const res = await fetch(
        `${API_URL}/tracker/history?tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
        {
            credentials: 'include',
        }
    );
    if (!res.ok) throw new Error('Failed to fetch history');
    const data = await res.json();

    const habitsObj: Record<number, HabitWithLogs> = {};

    data.forEach((habit: Habit & { dayLogs?: EnhancedDayLog[] }) => {

        const colorStops = habit.colorTheme === 'custom' ? habit.colorStops : GRADIENT_PRESETS[habit.colorTheme].stops;


        //Map day logs for easier 
        const dayLogsMap: DayLogs = {};
        if (habit.dayLogs) {
            habit.dayLogs.forEach((dl: EnhancedDayLog) => {

                dayLogsMap[dl.localDay!] = {
                    id: dl.id,
                    habitId: dl.habitId,
                    date: dl.date,
                    createdAt: dl.createdAt,
                    exerciseSessions: dl.exerciseSessions || [],
                    rating: dl.rating,
                    notes: dl.notes,
                    localDay: dl.localDay,
                };
            });
        }
        habitsObj[habit.id] = { ...habit, dayLogs: dayLogsMap, colorStops };
    });
    return habitsObj;
};

//Store for application State

interface UIState {
    selectedHabitId?: number;
    selectedLogId?: number;
    selectedDay: string;
    selectedSessionIndex: number;
    selectHabitId: (id?: number) => void;
    selectLogId: (id?: number) => void;
    selectDay: (day: string) => void;
    selectSessionIndex: (i: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
    selectedHabitId: undefined,
    selectedLogId: undefined,
    selectedDay: DateTime.now().toISODate(),
    selectedSessionIndex: 0,

    selectHabitId: (id) => set({ selectedHabitId: id }),
    selectLogId: (id) => set({ selectedLogId: id }),
    selectDay: (day) => set({ selectedDay: day }),
    selectSessionIndex: (i) => set({ selectedSessionIndex: i }),
}))

export function useTracker() {
    const { selectedHabitId, selectedDay } = useUIStore();

    const queryClient = useQueryClient();

    const historyQuery = useQuery({
        queryKey: ['habit-logs'],
        queryFn: fetchHistory,
        staleTime: 1000 * 60 * 5,
    });

    const habitsWithLogs = historyQuery.data ?? {};

    // --- Cache helpers ---
    const updateCache = (updater: (data: Record<number, HabitWithLogs>) => void) => {
        queryClient.setQueryData(['habit-logs'], (old: Record<number, HabitWithLogs> | undefined) => {
            if (!old) return {};
            // Shallow-copy the top-level record so that unchanged habit objects
            // keep their reference — this allows React.memo on row components to
            // skip re-renders for habits that weren't touched.
            const newData = { ...old };
            updater(newData);
            return newData;
        });
    };

    // --- Mutations ---

    // 0. Log Simple Habit
    const logSimple = useMutation({
        mutationFn: async (payload: { rating: number; habitId?: number; day?: string }) => {

            const effectiveDay = payload.day || selectedDay;
            const effectiveHabitId = payload.habitId || selectedHabitId;

            const timeStamp = DateTime.fromISO(effectiveDay)
                .setZone('local')
                .set({
                    hour: DateTime.local().hour,
                    minute: DateTime.local().minute,
                    second: DateTime.local().second,
                    millisecond: 0
                }).toISO();

            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const res = await fetch(`${API_URL}/tracker/check?tz=${tz}`, {
                method: 'POST',
                body: JSON.stringify({
                    habitId: Number(effectiveHabitId),
                    rating: Number(payload.rating),
                    timeStamp
                }),
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
            });
            return res.json();
        },
        onMutate: async (newItem) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData(['habit-logs']);

            const effectiveDay = newItem.day || selectedDay;
            const effectiveHabitId = newItem.habitId || selectedHabitId;

            updateCache((newData) => {
                const habit = newData[effectiveHabitId!];
                if (habit) {
                    // Create a new object only for this habit so other habits
                    // keep their reference and their memoized rows don't re-render.
                    const existingDayLog = habit.dayLogs[effectiveDay] ?? {
                        habitId: effectiveHabitId!,
                        date: effectiveDay,
                        exerciseSessions: [],
                    };
                    newData[effectiveHabitId!] = {
                        ...habit,
                        dayLogs: {
                            ...habit.dayLogs,
                            [effectiveDay]: { ...existingDayLog, rating: newItem.rating },
                        },
                    };
                }
            });
            return { previousData };
        },
        onError: (_err, _variables, context) => {
            if (context?.previousData) {
                queryClient.setQueryData(['habit-logs'], context.previousData);
            }
        },
    });

    return {
        habitsWithLogs,
        isLoading: historyQuery.isLoading,
        logSimple: logSimple.mutate,
    };
}
