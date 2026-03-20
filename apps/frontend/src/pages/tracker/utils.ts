import { format, subDays } from 'date-fns';
import { DateArg } from 'date-fns';
import { DateTime } from 'luxon';

// export const formatDate = (date: Date) => date.toISOString().split('T')[0];



/**
 * Compute a streak (consecutive days) backwards from `fromDate`.
 * Works for regular habits, complex/session habits, and anti-habits.
 */
export const computeStreak = (
    dayLogs: Record<string, { rating?: number; exerciseSessions?: unknown[] }>,
    fromDate: string,
    type: string,
    isAntiHabit?: boolean,
): number => {
    let streak = 0;
    let cursor = new Date(fromDate + 'T00:00:00.000');
    const maxDays = 365; // safety cap

    while (streak < maxDays) {
        const dateStr = format(cursor, 'yyyy-MM-dd');
        const log = dayLogs[dateStr];

        if (isAntiHabit) {
            const hasAnyLogs = Object.keys(dayLogs).length > 0;
            if (!hasAnyLogs) break;

            const earliestDate = Object.keys(dayLogs).sort()[0];
            if (dateStr < earliestDate) break;

            const wasAvoided = !log || (log.rating ?? 0) === 0;
            if (!wasAvoided) break;
        } else {
            const isCompleted = type === 'complex'
                ? (log?.exerciseSessions as unknown[] | undefined)?.length! > 0
                : (log?.rating ?? 0) > 0;
            if (!isCompleted) break;
        }

        streak++;
        cursor = subDays(cursor, 1);
    }
    return streak;
};

export const getIntensityColor = (value: number, baseColor = 'emerald') => {
    if (value === 0) return 'bg-slate-100 dark:bg-slate-800';
    const colors: Record<string, string[]> = {
        emerald: ['bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600', 'bg-emerald-800'],
        blue: ['bg-blue-200', 'bg-blue-400', 'bg-blue-600', 'bg-blue-800'],
        violet: ['bg-violet-200', 'bg-violet-400', 'bg-violet-600', 'bg-violet-800'],
        orange: ['bg-orange-200', 'bg-orange-400', 'bg-orange-600', 'bg-orange-800'],
        rose: ['bg-rose-200', 'bg-rose-400', 'bg-rose-600', 'bg-rose-800'],
        amber: ['bg-amber-200', 'bg-amber-400', 'bg-amber-600', 'bg-amber-800'],
        // Defaulting to a safe palette if custom color is missing
    };
    const palette = colors[baseColor] || colors.emerald;
    // Use Math.min(value, 4) to ensure we don't exceed the array length
    return palette[Math.min(value, 4) - 1] || palette[3];
};

export const getCalendarDates = () => {
    const dates = [];
    const today = new Date();
    // 53 weeks * 7 days
    const totalDays = 371;
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + (6 - today.getDay()));
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - totalDays + 1);

    let current = new Date(startDate);
    while (current <= endDate) {
        dates.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return dates;
};
