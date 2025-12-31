import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Exercise as TrackbitExercise, } from '@trackbit/types';
const API_URL = `${import.meta.env.VITE_API_URL}/exercise-info`;

interface Exercise extends TrackbitExercise {
    lastSetId: number;
    lastSetWeight: number;
    lastSetReps: number;
    lastSetCreatedAt: string;
}

const fetchExercises = async (): Promise<Exercise[]> => {
    const res = await fetch(`${API_URL}/exercises`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch exercises');
    return res.json();
};

const fetchMuscleGroups = async (): Promise<{ name: string; id: number }[]> => {
    const res = await fetch(`${API_URL}/muscle-groups`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch muscle groups');
    return res.json();
}

const createExercise = async (newExercise: { name: string; category: string; muscleGroups?: number[] }) => {
    const res = await fetch(`${API_URL}/exercises`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newExercise),
    });
    if (!res.ok) throw new Error('Failed to create exercise');
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
        },
    });

    // New: Local update for last set defaults
    const updateLastSetLocally = useMutation({
        mutationFn: async ({ exerciseId, reps, weight }: { exerciseId: number; reps: number; weight: number }) => {
            // No server call — immediate cache update only
            queryClient.setQueryData<Exercise[]>(['exercises'], (old = []) => {
                return old.map((ex) =>
                    ex.id === exerciseId
                        ? {
                            ...ex,
                            lastSetReps: reps,
                            lastSetWeight: weight,
                            // Optionally update lastSetCreatedAt if needed
                        }
                        : ex
                );
            });
            return { exerciseId, reps, weight };
        },
    });



    return {
        exercises: query.data ?? [],
        muscleGroups: muscleGroupsQuery.data ?? [],
        isLoading: query.isLoading,
        createExercise: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        updateLastSetLocally: updateLastSetLocally.mutate,
    };
}