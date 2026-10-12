import { useCallback, useSyncExternalStore } from 'react';

/** Whether [query] (a CSS media query) matches now; re-renders when that changes. */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback((onChange: () => void) => {
        const list = window.matchMedia(query);
        list.addEventListener('change', onChange);
        return () => list.removeEventListener('change', onChange);
    }, [query]);
    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}

/** Tailwind's `md` breakpoint and up. */
export const useIsDesktop = () => useMediaQuery('(min-width: 768px)');
