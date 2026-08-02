import { useEffect } from 'react';
import { create } from 'zustand';
import type { ExerciseSourceRef } from '@trackbit/types';
import { serializeSourceKey } from '@trackbit/types';
import { useSession } from '@/shared/lib/auth-client';
import { useExerciseSources } from './use-exercise-sources';

const API_URL = import.meta.env.VITE_API_URL;

// `key === null` is a value, not "unset": it means browse mode. `hydrated` is
// what tells that apart from "the session hasn't answered yet".
interface PreferredSourceStore {
    key: string | null;
    hydrated: boolean;
    hydrate: (key: string | null) => void;
    setKey: (key: string | null) => void;
}

// Shared across every mounted picker — the source is a user preference, so
// switching it in one session panel must move the others too.
const usePreferredSourceStore = create<PreferredSourceStore>((set) => ({
    key: null,
    hydrated: false,
    // First writer wins: a later session refetch must not stomp a choice the
    // user already made this render pass.
    hydrate: (key) => set((state) => (state.hydrated ? state : { key, hydrated: true })),
    setKey: (key) => set({ key, hydrated: true }),
}));

const persist = (key: string | null) =>
    fetch(`${API_URL}/me/preferences`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferredExerciseSource: key }),
    });

// The last-selected exercise source, persisted on the user row and carried back
// on the session. Every read resolves the stored key through the descriptor list
// — the single guard that turns a dangling key into browse mode instead of an
// error — and clears it on the way past.
export function usePreferredExerciseSource() {
    const { data: session } = useSession();
    const { sources, isLoading, isError } = useExerciseSources();
    const { key, hydrated, hydrate, setKey } = usePreferredSourceStore();

    const sessionKey =
        (session?.user as { preferredExerciseSource?: string | null } | undefined)
            ?.preferredExerciseSource ?? null;

    useEffect(() => {
        if (session?.user) hydrate(sessionKey);
    }, [session?.user, sessionKey, hydrate]);

    const descriptor = key === null ? null : (sources.find((s) => s.key === key) ?? null);
    const activeSource = descriptor?.ref ?? null;

    // Clearing a dangling key is a write, so it waits for descriptors to have
    // actually loaded — a slow or failed fetch must not wipe a valid preference.
    useEffect(() => {
        if (!hydrated || isLoading || isError || key === null || descriptor) return;
        setKey(null);
        void persist(null);
    }, [hydrated, isLoading, isError, key, descriptor, setKey]);

    const selectSource = (ref: ExerciseSourceRef | null) => {
        const next = ref === null ? null : serializeSourceKey(ref);
        setKey(next);
        void persist(next);
    };

    return {
        sources,
        // The resolved descriptor, or null for browse mode.
        descriptor,
        activeSource,
        selectSource,
        isLoadingSources: isLoading,
    };
}
