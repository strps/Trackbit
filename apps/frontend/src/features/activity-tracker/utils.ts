import { OptimisticExercisePerformance } from "../tracker/use-tracker";

/**
 * Formats a duration in seconds to a string.
 * - Less than 1 hour: "mm:ss" (e.g., "5:23")
 * - 1 hour or more: "h:mm:ss" (e.g., "1:05:23")
 */
export const formatDuration = (seconds: number | null | undefined): string => {
    if (seconds == null || isNaN(seconds)) return "-";
    const secs = Math.floor(seconds);
    const minutes = Math.floor(secs / 60);
    const remainingSeconds = secs % 60;
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours}:${remainingMinutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export const getAvgRpe = (performances: OptimisticExercisePerformance[]): number | null => {
    const values = performances.map(p => p.rpe).filter((v): v is number => v != null);
    if (values.length === 0) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
};

export const rpeColor = (rpe: number) => {
    if (rpe <= 3) return 'text-emerald-500';
    if (rpe <= 6) return 'text-amber-400';
    if (rpe <= 8) return 'text-orange-500';
    return 'text-red-500';
};
