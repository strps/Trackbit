import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { adjust, isExpired, type RestTimer } from './rest-timer';
import { primeRestAlert } from './rest-alert';

const STORAGE_KEY = 'trackbit.rest_timer';

interface RestTimerStore {
    rest: RestTimer | null;
    /** Starts the rest after a set, replacing the one running; 0 seconds is off and only ends it. */
    start: (seconds: number, dayLogId: number) => void;
    /** Moves the end by `ms`; see `adjust`. */
    adjust: (ms: number) => void;
    /** Ends the rest now: Skip, Done, or its overtime being over. */
    end: () => void;
}

export const useRestTimerStore = create<RestTimerStore>()(
    persist(
        (set, get) => ({
            rest: null,
            start: (seconds, dayLogId) => {
                if (seconds <= 0) return set({ rest: null });
                // Called from the click that added the set: the one chance to unlock audio.
                primeRestAlert();
                const now = Date.now();
                set({ rest: { startedAt: now, endsAt: now + seconds * 1000, dayLogId } });
            },
            adjust: (ms) => {
                const { rest } = get();
                if (rest) set({ rest: adjust(rest, ms, Date.now()) });
            },
            end: () => set({ rest: null }),
        }),
        {
            name: STORAGE_KEY,
            // Unavailable storage (a private window) leaves it in memory only.
            storage: createJSONStorage(() => localStorage),
            partialize: ({ rest }) => ({ rest }),
            onRehydrateStorage: () => (state) => {
                if (state?.rest && isExpired(state.rest, Date.now())) state.end();
            },
        },
    ),
);

// Another tab started, moved or ended it.
if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
        if (e.key === STORAGE_KEY) void useRestTimerStore.persist.rehydrate();
    });
}
