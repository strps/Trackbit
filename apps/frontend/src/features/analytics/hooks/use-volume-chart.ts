import { useMemo } from 'react';
import { subMonths, subYears, parseISO, isAfter, getISOWeek, getYear, startOfISOWeek, format } from 'date-fns';
import type { HabitWithLogs } from '@/features/tracker/use-tracker';
import { flattenPerformances } from '../utils/flattenPerformances';
import type { ExerciseWithLastPerformance } from '@/hooks/use-exercises';
import type { TimeRange } from './use-exercise-chart';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VolumeBreakdown = 'total' | 'stacked';

export interface WeeklyVolumePoint {
    /** ISO week label e.g. "Jan 6" (Monday of that week) */
    week: string;
    /** Raw ISO week key for sorting: "2024-W03" */
    weekKey: string;
    /** Total volume across all exercises */
    total: number;
    /** Average RPE across all sets that week (null if no RPE data) */
    avgRpe: number | null;
    /** Per-exercise volumes keyed by exerciseId string */
    [exerciseKey: string]: number | string | null;
}

export interface VolumeChartData {
    weeks: WeeklyVolumePoint[];
    /** Exercise ids that appear in the data, for rendering stacked bars */
    exerciseIds: number[];
    totalVolume: number;
    avgRpe: number | null;
    peakWeek: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RANGE_CUTOFF: Record<TimeRange, () => Date | null> = {
    '1M': () => subMonths(new Date(), 1),
    '3M': () => subMonths(new Date(), 3),
    '6M': () => subMonths(new Date(), 6),
    '1Y': () => subYears(new Date(), 1),
    'all': () => null,
};

/** Stable colour palette for up to 10 exercises in stacked view */
export const EXERCISE_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
    '#ef4444', '#06b6d4', '#f97316', '#84cc16',
    '#ec4899', '#6366f1',
];

const weekKey = (date: Date): string =>
    `${getYear(startOfISOWeek(date))}-W${String(getISOWeek(date)).padStart(2, '0')}`;

const weekLabel = (date: Date): string =>
    format(startOfISOWeek(date), 'MMM d');

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useVolumeChart(
    habit: HabitWithLogs | undefined,
    range: TimeRange,
    exercises: ExerciseWithLastPerformance[],
): VolumeChartData {
    return useMemo(() => {
        const empty: VolumeChartData = {
            weeks: [], exerciseIds: [], totalVolume: 0, avgRpe: null, peakWeek: null,
        };

        if (!habit) return empty;

        const cutoff = RANGE_CUTOFF[range]();
        const allPerfs = flattenPerformances(habit).filter((p) => {
            if (cutoff && !isAfter(parseISO(p.date), cutoff)) return false;
            // Only count sets that have at least weight or reps to form volume
            return p.weight != null && p.reps != null;
        });

        if (allPerfs.length === 0) return empty;

        // Map exerciseId → colour index (stable across re-renders via sort)
        const exerciseIdsSorted = [...new Set(allPerfs.map((p) => p.exerciseId))].sort((a, b) => a - b);

        // Aggregate by week
        type WeekAcc = {
            total: number;
            byExercise: Map<number, number>;
            rpeSum: number;
            rpeCount: number;
            weekLabel: string;
        };
        const byWeek = new Map<string, WeekAcc>();

        for (const perf of allPerfs) {
            const date = parseISO(perf.date);
            const key = weekKey(date);

            if (!byWeek.has(key)) {
                byWeek.set(key, {
                    total: 0,
                    byExercise: new Map(),
                    rpeSum: 0,
                    rpeCount: 0,
                    weekLabel: weekLabel(date),
                });
            }

            const acc = byWeek.get(key)!;
            const vol = perf.weight! * perf.reps!;
            acc.total += vol;
            acc.byExercise.set(
                perf.exerciseId,
                (acc.byExercise.get(perf.exerciseId) ?? 0) + vol,
            );
            if (perf.rpe != null) {
                acc.rpeSum += perf.rpe;
                acc.rpeCount += 1;
            }
        }

        // Build sorted week points
        const weeks: WeeklyVolumePoint[] = [...byWeek.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, acc]) => {
                const point: WeeklyVolumePoint = {
                    week: acc.weekLabel,
                    weekKey: key,
                    total: Math.round(acc.total),
                    avgRpe: acc.rpeCount > 0
                        ? Math.round((acc.rpeSum / acc.rpeCount) * 10) / 10
                        : null,
                };
                // Attach per-exercise volumes as dynamic keys
                for (const exId of exerciseIdsSorted) {
                    point[`ex_${exId}`] = Math.round(acc.byExercise.get(exId) ?? 0);
                }
                return point;
            });

        const totalVolume = weeks.reduce((s, w) => s + w.total, 0);
        const rpePoints = weeks.filter((w) => w.avgRpe != null);
        const avgRpe = rpePoints.length
            ? Math.round((rpePoints.reduce((s, w) => s + w.avgRpe!, 0) / rpePoints.length) * 10) / 10
            : null;
        const peakWeek = weeks.reduce(
            (best, w) => (w.total > (best ? byWeek.get(best)!.total : -Infinity) ? w.weekKey : best),
            null as string | null,
        );

        return { weeks, exerciseIds: exerciseIdsSorted, totalVolume, avgRpe, peakWeek };
    }, [habit, range, exercises]);
}