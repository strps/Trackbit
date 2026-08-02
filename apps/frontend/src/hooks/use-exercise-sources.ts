import { useQuery } from '@tanstack/react-query';
import type { ExerciseSourceDescriptor } from '@trackbit/types';
import { parseApiError } from '@/shared/lib/api-error';

const API_URL = `${import.meta.env.VITE_API_URL}/exercise-sources`;

const fetchSources = async (): Promise<ExerciseSourceDescriptor[]> => {
    const res = await fetch(API_URL, { credentials: 'include' });
    if (!res.ok) throw await parseApiError(res, 'Failed to fetch exercise sources');
    return res.json();
};

export const EXERCISE_SOURCES_QUERY_KEY = ['exercise-sources'] as const;

// The descriptors every source-aware UI branches on. Consumers ask what a source
// *can do* (`capabilities`), never what kind it is — which is what lets Phase 4
// programs and Phase 5 computed strategies appear here with no change on this side.
export function useExerciseSources() {
    const query = useQuery({
        queryKey: EXERCISE_SOURCES_QUERY_KEY,
        queryFn: fetchSources,
    });

    return {
        sources: query.data ?? [],
        isLoading: query.isLoading,
        isError: query.isError,
    };
}
