import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = 'http://localhost:3000/api/logs';

const fetchHistory = async (): Promise<Trackbit.DayLog[]> => {
    const res = await fetch(`${API_URL}/history`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
};

const logSimple = async (payload: { habitId: number, date: string, value: number }) => {
    const res = await fetch(`${API_URL}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to log');
    return res.json();
};

const logWorkout = async (payload: any) => {
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
    });

    const simpleMutation = useMutation({
        mutationFn: logSimple,
        onMutate: async (newItem) => {
            // Optimistic Update for Heatmap
            await queryClient.cancelQueries({ queryKey: ['habit-logs'] });
            const previousLogs = queryClient.getQueryData<Trackbit.DayLog[]>(['habit-logs']);

            queryClient.setQueryData(['habit-logs'], (old: Trackbit.DayLog[] = []) => {
                // Remove existing for that date/habit if exists, add new
                const filtered = old.filter(l => !(l.habitId === newItem.habitId && l.date === newItem.date));
                return [...filtered, { ...newItem, id: Math.random() }];
            });

            return { previousLogs };
        },
        onError: (_err, _new, ctx) => {
            if (ctx?.previousLogs) queryClient.setQueryData(['habit-logs'], ctx.previousLogs);
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['habit-logs'] })
    });

    const workoutMutation = useMutation({
        mutationFn: logWorkout,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['habit-logs'] });
        }
    });

    return {
        logs: historyQuery.data ?? [],
        isLoading: historyQuery.isLoading,
        logSimple: simpleMutation.mutate,
        logWorkout: workoutMutation.mutateAsync // Async so we can wait for form close
    };
}