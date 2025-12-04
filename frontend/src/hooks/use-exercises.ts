import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = 'http://localhost:3000/api/exercises';

export interface Exercise {
    id: number;
    name: string;
    category: 'strength' | 'cardio' | 'flexibility';
    muscleGroup?: string;
    userId?: string; // If null, it's a system default
    createdAt: string;
}

const fetchExercises = async (): Promise<Exercise[]> => {
    const res = await fetch(API_URL, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch exercises');
    return res.json();
};

const createExercise = async (newExercise: { name: string; category: string; muscleGroup?: string }) => {
    const res = await fetch(API_URL, {
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

    const createMutation = useMutation({
        mutationFn: createExercise,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['exercises'] });
        },
    });

    return {
        exercises: query.data ?? [],
        isLoading: query.isLoading,
        createExercise: createMutation.mutateAsync,
        isCreating: createMutation.isPending
    };
}