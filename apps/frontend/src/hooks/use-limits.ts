import { useQuery } from '@tanstack/react-query';
import { parseApiError } from '@/shared/lib/api-error';

export interface EffectiveLimits {
    maxHabits: number | null;
    maxCustomExercises: number | null;
    allowedHabitTypes: string[];
}

export interface LimitsResponse {
    effective: EffectiveLimits | null;
    counts: {
        habits: number;
        customExercises: number;
    };
}

const API_URL = `${import.meta.env.VITE_API_URL}/me/limits`;

const fetchLimits = async (): Promise<LimitsResponse> => {
    const res = await fetch(API_URL, { credentials: 'include' });
    if (!res.ok) throw await parseApiError(res, 'Failed to fetch limits');
    return res.json();
};

export function useLimits() {
    const query = useQuery({
        queryKey: ['me', 'limits'],
        queryFn: fetchLimits,
    });

    const effective = query.data?.effective ?? null;
    const counts = query.data?.counts;

    const atHabitCap = !!(
        effective?.maxHabits != null &&
        counts &&
        counts.habits >= effective.maxHabits
    );

    const atExerciseCap = !!(
        effective?.maxCustomExercises != null &&
        counts &&
        counts.customExercises >= effective.maxCustomExercises
    );

    const isHabitTypeAllowed = (type: string): boolean => {
        if (!effective) return true;
        return effective.allowedHabitTypes.includes(type);
    };

    return {
        effective,
        counts,
        atHabitCap,
        atExerciseCap,
        isHabitTypeAllowed,
        isLoading: query.isLoading,
    };
}
