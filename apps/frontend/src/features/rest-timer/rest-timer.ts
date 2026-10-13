// The rest countdown between sets, the same model as the Android app's: only the instants it
// started and ends are stored, never a ticking count, so a refresh or another page doesn't lose
// or reset it. Past its end it runs on, in overtime, until the next set replaces it, the user
// ends it, or OVERTIME_MS has passed.

export interface RestTimer {
    /** Epoch ms. */
    startedAt: number;
    /** Epoch ms. */
    endsAt: number;
    /** The day log whose session started it, to get back to it. */
    dayLogId: number;
}

/** What the −/+ buttons move the end by. */
export const STEP_MS = 15_000;

/** How long a rest counts on past its end before it goes away by itself. */
export const OVERTIME_MS = 15 * 60_000;

/** Later than this past the end (a throttled background tab), the end beep is only noise. */
export const ALERT_GRACE_MS = 2 * 60_000;

export const totalMs = (rest: RestTimer) => rest.endsAt - rest.startedAt;

/** The time to the end; negative in overtime. */
export const remainingMs = (rest: RestTimer, now: number) => rest.endsAt - now;

export const isOver = (rest: RestTimer, now: number) => now >= rest.endsAt;

export const isExpired = (rest: RestTimer, now: number) => now >= rest.endsAt + OVERTIME_MS;

/**
 * Moves the end by `ms` (negative: sooner). An end at or before now ends the rest (null); in
 * overtime it does nothing.
 */
export function adjust(rest: RestTimer, ms: number, now: number): RestTimer | null {
    if (isOver(rest, now)) return rest;
    const endsAt = rest.endsAt + ms;
    return endsAt > now ? { ...rest, endsAt } : null;
}

const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
};

/**
 * The time left, rounded up so it starts at the full rest and reads 0:01 in the last second;
 * then the overtime, rounded down, so 0:00 comes before −0:01.
 */
export function restText(remaining: number): string {
    if (remaining > 0) return formatDuration(Math.ceil(remaining / 1000) * 1000);
    return (remaining <= -1000 ? '−' : '') + formatDuration(-remaining);
}

/** How long until the shown second changes, below zero too: −300 ms left is 700 ms before −0:01. */
export const untilNextSecond = (remaining: number) => ((remaining % 1000) + 1000) % 1000 || 1000;
