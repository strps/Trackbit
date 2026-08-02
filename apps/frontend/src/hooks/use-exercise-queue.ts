import { useQuery } from '@tanstack/react-query';
import type { ExerciseSourceRef, QueueEntry, ResolvedQueue } from '@trackbit/types';
import { serializeSourceKey } from '@trackbit/types';
import { parseApiError } from '@/shared/lib/api-error';

const API_URL = `${import.meta.env.VITE_API_URL}/exercise-sources`;

// Prefix key: one resolved queue per source key, so any list write can invalidate
// every resolved queue at once.
export const EXERCISE_QUEUE_QUERY_KEY = ['exercise-source'] as const;

// A 404 is not an error here. It means the ref no longer resolves — the list was
// deleted, a program deactivated, a trainer relationship ended — and the picker
// answers that by falling back to browse mode, never by toasting.
const fetchQueue = async (key: string): Promise<ResolvedQueue | null> => {
    const res = await fetch(`${API_URL}/${key}`, { credentials: 'include' });
    if (res.status === 404) return null;
    if (!res.ok) throw await parseApiError(res, 'Failed to resolve exercise source');
    return res.json();
};

// The subset of a log the cursor cares about. Typed structurally so both the
// server log and the optimistic one satisfy it.
export interface QueueCursorLog {
    exerciseId: number;
    listItemId: number | null;
}

// An entry is "done" when a log in this session came from that exact list item.
// Matching on provenance rather than on exerciseId is what keeps the cursor
// correct when a routine legitimately repeats an exercise (top set + backoff);
// exerciseId is only the fallback for computed sources, which carry no item id.
function makeIsDone(sessionLogs: QueueCursorLog[]): (entry: QueueEntry) => boolean {
    const doneItemIds = new Set(
        sessionLogs.map((log) => log.listItemId).filter((id): id is number => id !== null),
    );
    const doneExerciseIds = new Set(sessionLogs.map((log) => log.exerciseId));

    return (entry) =>
        entry.listItemId !== null
            ? doneItemIds.has(entry.listItemId)
            : doneExerciseIds.has(entry.exerciseId);
}

// The cursor is derived, never stored: welding it to the server would mean every
// added log invalidates the queue, and a second source of truth for "what's
// logged today" alongside the session the client already holds.
// Returns -1 for an empty queue.
export function nextQueueIndex(entries: QueueEntry[], sessionLogs: QueueCursorLog[]): number {
    if (entries.length === 0) return -1;

    const isDone = makeIsDone(sessionLogs);

    const firstPending = entries.findIndex((entry) => !isDone(entry));
    if (firstPending !== -1) return firstPending;

    // Every entry logged → keep cycling from whichever entry was logged last, so
    // extra rounds follow the source order instead of restarting at the top.
    for (let i = sessionLogs.length - 1; i >= 0; i--) {
        const log = sessionLogs[i];
        const lastIdx = entries.findIndex((entry) =>
            log.listItemId !== null
                ? entry.listItemId === log.listItemId
                : entry.exerciseId === log.exerciseId,
        );
        if (lastIdx !== -1) return (lastIdx + 1) % entries.length;
    }

    return 0;
}

// Resolves the active source to its queue plus a client-derived cursor.
// `null` is browse mode — no queue, nothing to advance — and is deliberately not
// modelled as a source, so nothing here special-cases the full catalog.
export function useExerciseQueue(
    activeSource: ExerciseSourceRef | null,
    sessionLogs: QueueCursorLog[],
) {
    const key = activeSource ? serializeSourceKey(activeSource) : null;

    const query = useQuery({
        queryKey: [...EXERCISE_QUEUE_QUERY_KEY, key],
        queryFn: () => fetchQueue(key as string),
        enabled: key !== null,
        // Dynamic sources (programs, computed strategies) change without a user
        // edit; list writes invalidate this key directly, so a short TTL only has
        // to cover the dynamic case.
        staleTime: 30_000,
    });

    const queue = query.data ?? null;
    const entries = queue?.entries ?? [];
    const isDone = makeIsDone(sessionLogs);

    const cursor = nextQueueIndex(entries, sessionLogs);

    return {
        queue,
        entries,
        done: entries.map(isDone),
        cursor,
        nextEntry: cursor === -1 ? null : (entries[cursor] ?? null),
        emptyReason: queue?.emptyReason ?? null,
        // A ref that resolved to nothing dangles: the caller renders browse mode
        // and clears the stored preference.
        isDangling: key !== null && query.isSuccess && query.data === null,
        isLoading: key !== null && query.isLoading,
    };
}
