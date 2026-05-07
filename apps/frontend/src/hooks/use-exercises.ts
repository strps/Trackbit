import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Exercise } from '@trackbit/types';
import { parseApiError } from '@/shared/lib/api-error';

const API_URL = `${import.meta.env.VITE_API_URL}/exercise-info`;

export interface ExerciseWithLastPerformance extends Exercise {
    lastPerformance?: {
        id: number | null;
        weight: number | null;
        reps: number | null;
        distance: number | null;
        duration: number | null;
        rpe?: number | null;
        createdAt: string;
    };
}

const fetchExercises = async (): Promise<ExerciseWithLastPerformance[]> => {
    const res = await fetch(`${API_URL}/exercises`, { credentials: 'include' });
    if (!res.ok) throw await parseApiError(res, 'Failed to fetch exercises');
    return res.json();
};

const fetchMuscleGroups = async (): Promise<{ name: string; id: number }[]> => {
    const res = await fetch(`${API_URL}/muscle-groups`, { credentials: 'include' });
    if (!res.ok) throw await parseApiError(res, 'Failed to fetch muscle groups');
    return res.json();
};

const createExercise = async (newExercise: { name: string; category: string; muscleGroups?: number[] }) => {
    const res = await fetch(`${API_URL}/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newExercise),
    });
    if (!res.ok) throw await parseApiError(res, 'Failed to create exercise');
    return res.json();
};

const deleteExercise = async (id: number) => {
    const res = await fetch(`${API_URL}/exercises/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw await parseApiError(res, 'Failed to delete exercise');
    return res.json();
};

const updateExercise = async ({ id, ...data }: { id: number; name: string; category: string; muscleGroups?: number[]; description?: string }) => {
    const res = await fetch(`${API_URL}/exercises/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
    });
    if (!res.ok) throw await parseApiError(res, 'Failed to update exercise');
    return res.json();
};

export function useExercises() {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['exercises'],
        queryFn: fetchExercises,
    });

    const muscleGroupsQuery = useQuery({
        queryKey: ['muscle-groups'],
        queryFn: fetchMuscleGroups,
    });

    const createMutation = useMutation({
        mutationFn: createExercise,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exercises'] });
            queryClient.invalidateQueries({ queryKey: ['me', 'limits'] });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: deleteExercise,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exercises'] });
            queryClient.invalidateQueries({ queryKey: ['me', 'limits'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: updateExercise,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises'] }),
    });

    // Local-only optimistic update for last performance (used by activity-tracker)
    const updateLastPerformance = useMutation({
        mutationFn: async ({
            exerciseId,
            lastPerformance,
        }: {
            exerciseId: number;
            lastPerformance: ExerciseWithLastPerformance['lastPerformance'];
        }) => {
            queryClient.setQueryData<ExerciseWithLastPerformance[]>(['exercises'], (old = []) => {
                return old.map((ex) =>
                    ex.id === exerciseId
                        ? { ...ex, lastPerformance }
                        : ex
                );
            });
            return { exerciseId, lastPerformance };
        },
    });

    return {
        exercises: query.data ?? [],
        muscleGroups: muscleGroupsQuery.data ?? [],
        isLoading: query.isLoading,
        createExercise: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        deleteExercise: deleteMutation.mutate,
        isDeleting: deleteMutation.isPending,
        updateExercise: updateMutation.mutateAsync,
        isUpdating: updateMutation.isPending,
        updateLastPerformance: updateLastPerformance.mutate,
    };
}