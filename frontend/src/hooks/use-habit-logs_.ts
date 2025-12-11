import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = 'http://localhost:3000/api/logs';

// --- Types ---
interface HabitWithLogs extends Trackbit.Habit {
    // Map: "2023-11-01" -> DayLog Object
    dayLogs: Record<string, Trackbit.DayLog>;
}

// --- Fetcher ---
const fetchHistory = async (): Promise<Record<string, HabitWithLogs>> => {
    const res = await fetch(`${API_URL}/history`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch history');

    const habitsArray = await res.json();
    let habitsObj: Record<string, HabitWithLogs> = {};

    // Converting list to optimized map for O(1) lookup
    habitsArray.forEach((habit: any) => {
        let dayLogsList = habit.dayLogs || []; // Ensure array exists
        const dayLogsObj: Record<string, Trackbit.DayLog> = {};

        dayLogsList.forEach((dayLog: any) => {
            dayLogsObj[dayLog.date] = dayLog;
        });

        habitsObj[habit.id] = { ...habit, dayLogs: dayLogsObj };
    });

    return habitsObj;
};

// --- API Calls ---
const logSimple = async (payload: { habitId: number, date: string, rating: number }) => {
    const res = await fetch(`${API_URL}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Failed to log');
    return res.json();
};

const logWorkout = async (payload: { id?: number, habitId: number, date: string, sets: any[] }) => {
    const res = await fetch(`${API_URL}/workout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to log workout');
    return res.json();
};

export function useHabitLogs() {
    const queryClient = useQueryClient();

    const historyQuery = useQuery({
        queryKey: ['habit-logs'],
        queryFn: fetchHistory,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    // Simple Habit Mutation (Optimistic)
    const simpleMutation = useMutation({
        mutationFn: logSimple,
        onMutate: async (newItem) => {
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousData = queryClient.getQueryData<Record<string, HabitWithLogs>>(['habit-logs']);

            if (previousData) {
                const newData = { ...previousData };
                const habit = newData[newItem.habitId];
                if (habit) {
                    // Update the specific date in the map
                    habit.dayLogs = {
                        ...habit.dayLogs,
                        [newItem.date]: {
                            ...habit.dayLogs[newItem.date],
                            value: newItem.rating,
                            date: newItem.date,
                            habitId: newItem.habitId,
                            id: Math.random() // Temp ID
                        } as Trackbit.DayLog
                    };
                    queryClient.setQueryData(['habit-logs'], newData);
                }
            }

            return { previousData };
        },
        onError: (_err, _new, ctx) => {
            if (ctx?.previousData) queryClient.setQueryData(['habit-logs'], ctx.previousData);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] })
    });

    // Complex Workout Mutation (Auto-Save Batching handled in component)
    const workoutMutation = useMutation({
        mutationFn: logWorkout,
        onSuccess: () => {
            // We invalidate silently to re-fetch the real IDs of new sets
            queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
        }
    });

    return {
        // Return the optimized map directly
        habitsWithLogs: historyQuery.data ?? {},
        isLoading: historyQuery.isLoading,
        logSimple: simpleMutation.mutate,
        logWorkout: workoutMutation.mutateAsync
    };
}



// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// const API_URL = 'http://localhost:3000/api/logs';



// interface HabitWithLogs extends Trackbit.Habit {
//     dayLogs: Record<string, Trackbit.DayLog>;
// }


// const fetchHistory = async (): Promise<Record<string, HabitWithLogs>> => {
//     const res = await fetch(`${API_URL}/history`, { credentials: 'include' });
//     if (!res.ok) throw new Error('Failed to fetch history');

//     const habitsArray = await res.json();

//     let habitsObj = {}

//     //Converting list to json in order ot use as a map for easy retrieval and visulization.
//     habitsArray.forEach((habit: any) => {
//         let dayLogs = habit.dayLogs;
//         const dayLogsObj = {};

//         dayLogs.forEach((dayLog: any) => {
//             dayLogsObj[dayLog.date] = dayLog;
//         });

//         habitsObj[habit.id] = { dayLogs: dayLogsObj, ...habit };
//     });

//     return habitsObj;
// };

// const logSimple = async (payload: { habitId: number, date: string, value: number }) => {
//     const res = await fetch(`${API_URL}/check`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         credentials: 'include',
//         body: JSON.stringify(payload)
//     });
//     if (!res.ok) throw new Error('Failed to log');
//     return res.json();
// };

// const logWorkout = async (payload: any) => {
//     const res = await fetch(`${API_URL}/workout`, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         credentials: 'include',
//         body: JSON.stringify(payload)
//     });
//     if (!res.ok) throw new Error('Failed to log workout');
//     return res.json();
// };

// export function useHabitLogs() {
//     const queryClient = useQueryClient();

//     const historyQuery = useQuery({
//         queryKey: ['habit-logs'],
//         queryFn: fetchHistory,
//     });

//     const simpleMutation = useMutation({
//         mutationFn: logSimple,
//         onMutate: async (newItem) => {
//             // Optimistic Update for Heatmap
//             await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
//             const previousLogs = queryClient.getQueryData<Trackbit.DayLog[]>(['habit-logs']);

//             queryClient.setQueryData(['habit-logs'], (old: Trackbit.DayLog[] = []) => {
//                 // Remove existing for that date/habit if exists, add new
//                 const filtered = old.filter(l => !(l.habitId === newItem.habitId && l.date === newItem.date));
//                 return [...filtered, { ...newItem, id: Math.random() }];
//             });

//             return { previousLogs };
//         },
//         onError: (_err, _new, ctx) => {
//             if (ctx?.previousLogs) queryClient.setQueryData(['habit-logs'], ctx.previousLogs);
//         },
//         onSettled: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] })
//     });

//     const workoutMutation = useMutation({
//         mutationFn: logWorkout,
//         onSuccess: () => {
//             queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
//         }
//     });

//     return {
//         habitsWithlogs: historyQuery.data ?? {},
//         isLoading: historyQuery.isLoading,
//         logSimple: simpleMutation.mutate,
//         logWorkout: workoutMutation.mutateAsync // Async so we can wait for form close
//     };
// }