import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ExerciseList, ExerciseListItem, Prescription } from '@trackbit/types';
import i18next from 'i18next';
import { toast } from 'sonner';
import { EXERCISE_QUEUE_QUERY_KEY } from '@/hooks/use-exercise-queue';
import { EXERCISE_SOURCES_QUERY_KEY } from '@/hooks/use-exercise-sources';
import { ApiError, parseApiError } from '@/shared/lib/api-error';

const API_URL = `${import.meta.env.VITE_API_URL}/exercise-lists`;

export const EXERCISE_LISTS_QUERY_KEY = ['exercise-lists'] as const;

export interface ExerciseListWithItems extends ExerciseList {
    items: ExerciseListItem[];
    frozen: boolean;
}

// An item for PUT /:id/items. Its `uuid` names it: one the list holds means "keep this row" —
// the backend diffs on it so `exercise_log.list_item_id` provenance survives a reorder; a new
// item gets a fresh one here, so the optimistic row already has its final identity. Array order
// *is* the position: the mutation numbers them, so no caller can send a non-permutation.
// `exerciseUuid` only fills the optimistic row; the wire names the exercise by id.
export type ListItemInput = { uuid: string; exerciseId: number; exerciseUuid: string } & Partial<Prescription>;

export function newItemInput(exercise: { id: number; uuid: string }): ListItemInput {
    return { uuid: crypto.randomUUID(), exerciseId: exercise.id, exerciseUuid: exercise.uuid };
}

// Existing items round-trip through here so editing order never silently drops a
// prescription the Phase 4 editor put there.
export function toItemInput(item: ExerciseListItem): ListItemInput {
    return {
        uuid: item.uuid,
        exerciseId: item.exerciseId,
        exerciseUuid: item.exerciseUuid,
        targetSets: item.targetSets,
        targetReps: item.targetReps,
        targetWeight: item.targetWeight,
        targetDuration: item.targetDuration,
        targetDistance: item.targetDistance,
        restSeconds: item.restSeconds,
        notes: item.notes,
    };
}

// --- Fetcher Functions ---

const fetchLists = async (): Promise<ExerciseListWithItems[]> => {
    const res = await fetch(API_URL, { credentials: 'include' });
    if (!res.ok) throw await parseApiError(res, 'Failed to fetch exercise lists');
    return res.json();
};

const createList = async (input: { name: string; description?: string | null }) => {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
    });
    if (!res.ok) throw await parseApiError(res, 'Failed to create list');
    return res.json() as Promise<ExerciseListWithItems>;
};

const updateList = async ({ id, ...updates }: { id: number; name?: string; description?: string | null }) => {
    const res = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw await parseApiError(res, 'Failed to update list');
    return res.json() as Promise<ExerciseListWithItems>;
};

// The whole order in one call, stored in one transaction. Frozen lists must stay at the end.
const reorderLists = async (orderedIds: number[]) => {
    const res = await fetch(`${API_URL}/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ids: orderedIds }),
    });
    if (!res.ok) throw await parseApiError(res, 'Failed to reorder lists');
    return res.json() as Promise<ExerciseListWithItems[]>;
};

// Appends one exercise at the end on the server, so a stale copy of the items can't overwrite
// changes made elsewhere (as a replace-all built from the cache could).
const appendItem = async ({ listId, exerciseId }: { listId: number; exerciseId: number }) => {
    const res = await fetch(`${API_URL}/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ exerciseId }),
    });
    if (!res.ok) throw await parseApiError(res, 'Failed to add to list');
    return res.json() as Promise<{ listId: number; items: ExerciseListItem[] }>;
};

const deleteList = async (id: number) => {
    const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        credentials: 'include',
    });
    if (!res.ok) throw await parseApiError(res, 'Failed to delete list');
    return res.json();
};

const putItems = async ({ listId, items }: { listId: number; items: ListItemInput[] }) => {
    const res = await fetch(`${API_URL}/${listId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            items: items.map(({ exerciseUuid: _exerciseUuid, ...item }, index) => ({ ...item, position: index })),
        }),
    });
    if (!res.ok) throw await parseApiError(res, 'Failed to save list items');
    return res.json() as Promise<{ listId: number; items: ExerciseListItem[] }>;
};

// Every list write funnels its failures through here so the limit/freeze codes
// get the same treatment they do for habits and custom exercises.
export function toastListError(err: unknown) {
    if (err instanceof ApiError) {
        switch (err.code) {
            case 'exercise_list_limit_reached':
                toast.error(i18next.t('errors:limits.exercise_list_limit_reached_title'), {
                    description: i18next.t('errors:limits.exercise_list_limit_reached_body', {
                        maxExerciseLists: err.payload.maxExerciseLists ?? 0,
                    }),
                });
                return;
            case 'exercise_list_frozen':
                toast.error(i18next.t('errors:limits.exercise_list_frozen_title'), {
                    description: i18next.t('errors:limits.exercise_list_frozen_body'),
                });
                return;
            case 'exercise_list_name_taken':
                toast.error(i18next.t('lists:error.name_taken_title'), {
                    description: i18next.t('lists:error.name_taken_body'),
                });
                return;
        }
    }
    toast.error(i18next.t('lists:error.generic_title'), {
        description: i18next.t('lists:error.generic_body'),
    });
}

// --- Custom Hook ---

export function useExerciseLists() {
    const queryClient = useQueryClient();

    const listsQuery = useQuery({
        queryKey: EXERCISE_LISTS_QUERY_KEY,
        queryFn: fetchLists,
    });

    // Lists are also exercise sources, so any write invalidates the descriptors
    // and every already-resolved queue that could have been built from them.
    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: EXERCISE_LISTS_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: EXERCISE_SOURCES_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: EXERCISE_QUEUE_QUERY_KEY });
    };

    const createMutation = useMutation({
        mutationFn: createList,
        onError: toastListError,
        onSettled: () => {
            invalidateAll();
            queryClient.invalidateQueries({ queryKey: ['me', 'limits'] });
        },
    });

    const updateMutation = useMutation({
        mutationFn: updateList,
        onMutate: async (updates) => {
            await queryClient.cancelQueries({ queryKey: EXERCISE_LISTS_QUERY_KEY });
            const previous = queryClient.getQueryData<ExerciseListWithItems[]>(EXERCISE_LISTS_QUERY_KEY);

            queryClient.setQueryData<ExerciseListWithItems[]>(EXERCISE_LISTS_QUERY_KEY, (old = []) =>
                old.map((list) => (list.id === updates.id ? { ...list, ...updates } : list))
            );

            return { previous };
        },
        onError: (err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(EXERCISE_LISTS_QUERY_KEY, context.previous);
            toastListError(err);
        },
        onSettled: invalidateAll,
    });

    const deleteMutation = useMutation({
        mutationFn: deleteList,
        onMutate: async (listId) => {
            await queryClient.cancelQueries({ queryKey: EXERCISE_LISTS_QUERY_KEY });
            const previous = queryClient.getQueryData<ExerciseListWithItems[]>(EXERCISE_LISTS_QUERY_KEY);

            queryClient.setQueryData<ExerciseListWithItems[]>(EXERCISE_LISTS_QUERY_KEY, (old = []) =>
                old.filter((list) => list.id !== listId)
            );

            return { previous };
        },
        onError: (err, _id, context) => {
            if (context?.previous) queryClient.setQueryData(EXERCISE_LISTS_QUERY_KEY, context.previous);
            toastListError(err);
        },
        onSettled: () => {
            invalidateAll();
            queryClient.invalidateQueries({ queryKey: ['me', 'limits'] });
        },
    });

    const reorderMutation = useMutation({
        mutationFn: reorderLists,
        onMutate: async (orderedIds) => {
            await queryClient.cancelQueries({ queryKey: EXERCISE_LISTS_QUERY_KEY });
            const previous = queryClient.getQueryData<ExerciseListWithItems[]>(EXERCISE_LISTS_QUERY_KEY);

            queryClient.setQueryData<ExerciseListWithItems[]>(EXERCISE_LISTS_QUERY_KEY, (old = []) => {
                const positionOf = new Map(orderedIds.map((id, index) => [id, index]));
                return [...old]
                    .map((list) => ({ ...list, position: positionOf.get(list.id) ?? list.position }))
                    .sort((a, b) => a.position - b.position);
            });

            return { previous };
        },
        onError: (err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(EXERCISE_LISTS_QUERY_KEY, context.previous);
            toastListError(err);
        },
        onSettled: invalidateAll,
    });

    const saveItemsMutation = useMutation({
        mutationFn: putItems,
        onMutate: async ({ listId, items }) => {
            await queryClient.cancelQueries({ queryKey: EXERCISE_LISTS_QUERY_KEY });
            const previous = queryClient.getQueryData<ExerciseListWithItems[]>(EXERCISE_LISTS_QUERY_KEY);

            queryClient.setQueryData<ExerciseListWithItems[]>(EXERCISE_LISTS_QUERY_KEY, (old = []) =>
                old.map((list) =>
                    list.id === listId
                        ? {
                            ...list,
                            items: items.map((item, index) => ({
                                targetSets: null,
                                targetReps: null,
                                targetWeight: null,
                                targetDuration: null,
                                targetDistance: null,
                                restSeconds: null,
                                notes: null,
                                ...item,
                                // New rows have no id yet; a negative placeholder keeps
                                // React keys stable until the server response lands.
                                id: list.items.find((kept) => kept.uuid === item.uuid)?.id ?? -(index + 1),
                                listId,
                                position: index,
                            })),
                        }
                        : list
                )
            );

            return { previous };
        },
        onSuccess: ({ listId, items }) => {
            queryClient.setQueryData<ExerciseListWithItems[]>(EXERCISE_LISTS_QUERY_KEY, (old = []) =>
                old.map((list) => (list.id === listId ? { ...list, items } : list))
            );
        },
        onError: (err, _vars, context) => {
            if (context?.previous) queryClient.setQueryData(EXERCISE_LISTS_QUERY_KEY, context.previous);
            toastListError(err);
        },
        onSettled: invalidateAll,
    });

    const appendMutation = useMutation({
        mutationFn: appendItem,
        onSuccess: ({ listId, items }) => {
            queryClient.setQueryData<ExerciseListWithItems[]>(EXERCISE_LISTS_QUERY_KEY, (old = []) =>
                old.map((list) => (list.id === listId ? { ...list, items } : list))
            );
        },
        onError: toastListError,
        onSettled: invalidateAll,
    });

    return {
        lists: listsQuery.data ?? [],
        isLoading: listsQuery.isLoading,
        isError: listsQuery.isError,
        isSaving: createMutation.isPending || updateMutation.isPending || saveItemsMutation.isPending,
        createList: createMutation.mutateAsync,
        updateList: updateMutation.mutate,
        deleteList: deleteMutation.mutate,
        reorderLists: reorderMutation.mutate,
        saveItems: saveItemsMutation.mutate,
        appendExercise: appendMutation.mutate,
    };
}
