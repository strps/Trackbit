import { useMemo } from 'react';
import { subMonths, subYears, parseISO, isAfter } from 'date-fns';
import type { HabitWithLogs } from '@/features/tracker/use-tracker';
import { flattenPerformances } from '../utils/flattenPerformances';
import type { ExerciseWithLastPerformance } from '@/hooks/use-exercises';
import type { TimeRange } from './use-exercise-chart';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MuscleMetric = 'volume' | 'frequency';

export interface MuscleGroupPoint {
    /** Muscle group name — used as the radar axis label */
    muscle: string;
    value: number;
    /** Normalised 0–100 for the radar fill */
    normalised: number;
}

export interface MuscleChartData {
    points: MuscleGroupPoint[];
    metric: MuscleMetric;
    maxValue: number;
    topMuscle: string | null;
    neglectedMuscle: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RANGE_CUTOFF: Record<TimeRange, () => Date | null> = {
    '1M': () => subMonths(new Date(), 1),
    '3M': () => subMonths(new Date(), 3),
    '6M': () => subMonths(new Date(), 6),
    '1Y': () => subYears(new Date(), 1),
    'all': () => null,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useMuscleChart(
    habit: HabitWithLogs | undefined,
    range: TimeRange,
    metric: MuscleMetric,
    exercises: ExerciseWithLastPerformance[],
): MuscleChartData {
    return useMemo(() => {
        const empty: MuscleChartData = {
            points: [], metric, maxValue: 0, topMuscle: null, neglectedMuscle: null,
        };

        if (!habit) return empty;

        // Build exerciseId → muscleGroups lookup
        const exerciseMuscles = new Map<number, string[]>();
        for (const ex of exercises) {
            const muscles = (ex as any).muscleGroups as { id: number; name: string }[] | undefined;
            if (muscles?.length) {
                exerciseMuscles.set(ex.id, muscles.map((m) => m.name));
            }
        }

        const cutoff = RANGE_CUTOFF[range]();
        const allPerfs = flattenPerformances(habit).filter((p) => {
            if (cutoff && !isAfter(parseISO(p.date), cutoff)) return false;
            return true;
        });

        if (allPerfs.length === 0) return empty;

        // Aggregate per muscle group
        const muscleVolume = new Map<string, number>();
        const muscleFrequency = new Map<string, number>();

        // For frequency we count unique (date, exerciseId) pairs per muscle
        const seen = new Set<string>();

        for (const perf of allPerfs) {
            const muscles = exerciseMuscles.get(perf.exerciseId);
            if (!muscles?.length) continue;

            for (const muscle of muscles) {
                // Volume
                if (perf.weight != null && perf.reps != null) {
                    muscleVolume.set(muscle, (muscleVolume.get(muscle) ?? 0) + perf.weight * perf.reps);
                }

                // Frequency — count each exercise on each date once per muscle
                const freqKey = `${perf.date}:${perf.exerciseId}:${muscle}`;
                if (!seen.has(freqKey)) {
                    seen.add(freqKey);
                    muscleFrequency.set(muscle, (muscleFrequency.get(muscle) ?? 0) + 1);
                }
            }
        }

        const sourceMap = metric === 'volume' ? muscleVolume : muscleFrequency;

        if (sourceMap.size === 0) return empty;

        const maxValue = Math.max(...sourceMap.values());

        const points: MuscleGroupPoint[] = [...sourceMap.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([muscle, value]) => ({
                muscle,
                value: metric === 'volume' ? Math.round(value) : value,
                normalised: maxValue > 0 ? Math.round((value / maxValue) * 100) : 0,
            }));

        const sorted = [...points].sort((a, b) => b.value - a.value);
        const topMuscle = sorted[0]?.muscle ?? null;
        const neglectedMuscle = sorted[sorted.length - 1]?.muscle ?? null;

        return { points, metric, maxValue: Math.round(maxValue), topMuscle, neglectedMuscle };
    }, [habit, range, metric, exercises]);
}