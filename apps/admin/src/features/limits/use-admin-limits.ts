import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const API_URL = `${import.meta.env.VITE_API_URL}/admin/limits`;

export const HABIT_TYPES = ["count", "complex", "negative", "timed", "check"] as const;
export type HabitType = (typeof HABIT_TYPES)[number];

export interface AdminLimits {
    id: number;
    role: string;
    maxHabits: number | null;
    maxCustomExercises: number | null;
    maxExerciseLists: number | null;
    allowedHabitTypes: string[] | null;
}

export interface CreateLimitsInput {
    role: string;
    maxHabits?: number | null;
    maxCustomExercises?: number | null;
    maxExerciseLists?: number | null;
    allowedHabitTypes?: HabitType[];
}

export interface UpdateLimitsInput {
    maxHabits?: number | null;
    maxCustomExercises?: number | null;
    maxExerciseLists?: number | null;
    allowedHabitTypes?: HabitType[];
}

async function fetchLimits(): Promise<AdminLimits[]> {
    const res = await fetch(API_URL, { credentials: "include" });
    if (!res.ok) throw new Error("Failed to fetch limits");
    return res.json();
}

async function createLimits(input: CreateLimitsInput): Promise<AdminLimits> {
    const res = await fetch(API_URL, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create limits");
    }
    return res.json();
}

async function updateLimits({ role, ...patch }: UpdateLimitsInput & { role: string }): Promise<AdminLimits> {
    const res = await fetch(`${API_URL}/${encodeURIComponent(role)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to update limits");
    }
    return res.json();
}

async function deleteLimits(role: string): Promise<void> {
    const res = await fetch(`${API_URL}/${encodeURIComponent(role)}`, {
        method: "DELETE",
        credentials: "include",
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete limits");
    }
}

const QUERY_KEY = ["admin", "limits"] as const;

export function useAdminLimits() {
    const queryClient = useQueryClient();
    const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

    const limitsQuery = useQuery({
        queryKey: QUERY_KEY,
        queryFn: fetchLimits,
    });

    const createMutation = useMutation({ mutationFn: createLimits, onSuccess: invalidate });
    const updateMutation = useMutation({ mutationFn: updateLimits, onSuccess: invalidate });
    const deleteMutation = useMutation({ mutationFn: deleteLimits, onSuccess: invalidate });

    return {
        limits: limitsQuery.data ?? [],
        isLoading: limitsQuery.isLoading,
        error: limitsQuery.error,
        create: createMutation.mutate,
        isCreating: createMutation.isPending,
        update: updateMutation.mutate,
        isUpdating: updateMutation.isPending,
        remove: deleteMutation.mutate,
        isDeleting: deleteMutation.isPending,
    };
}
