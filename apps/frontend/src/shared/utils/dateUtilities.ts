import { format, parse, set } from "date-fns";


export function getLocalDayWithCurrentTime(selectedDayStr: string): Date {
    const base = parse(selectedDayStr, 'yyyy-MM-dd', new Date());
    const now = new Date();

    return set(base, {
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
        milliseconds: now.getMilliseconds(),
    });
}




// UTC date string – safe for backend/storage/heatmaps
export function getUTCDateString(date: Date): string {
    return date.toISOString().split('T')[0];
    // or: formatISO(date, { representation: 'date' }) but only if you know it's UTC
}

// Local calendar date – safe for UI display
export function getLocalDateString(date: Date): string {
    return format(date, 'yyyy-MM-dd');
    // or: formatISO(date, { representation: 'date' })
}