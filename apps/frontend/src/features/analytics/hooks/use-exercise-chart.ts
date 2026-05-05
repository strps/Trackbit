import { useMemo } from 'react';
import { subMonths, subYears, parseISO, isAfter } from 'date-fns';
import type { HabitWithLogs } from '@/features/tracker/use-tracker';
import { flattenPerformances } from '../utils/flattenPerformances';
import type { ExerciseWithLastPerformance } from '@/hooks/use-exercises';
import { kgToDisplay, weightUnit, type UnitSystem } from '@/shared/utils/intlFormatter';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChartMetric = 'maxWeight' | 'totalVolume' | 'estimatedOneRM' | 'avgRpe';
export type TimeRange = '1M' | '3M' | '6M' | '1Y' | 'all';

export interface ChartDataPoint {
    date: string;
    value: number;
    isPR: boolean;
}

export interface ExerciseChartData {
    data: ChartDataPoint[];
    unit: string;
    prCount: number;
    allTimeMax: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RANGE_CUTOFF: Record<TimeRange, () => Date | null> = {
    '1M': () => subMonths(new Date(), 1),
    '3M': () => subMonths(new Date(), 3),
    '6M': () => subMonths(new Date(), 6),
    '1Y': () => subYears(new Date(), 1),
    'all': () => null,
};

/** Epley 1RM formula: weight × (1 + reps / 30) */
const epley1RM = (weight: number, reps: number): number =>
    weight * (1 + reps / 30);

function getUnit(metric: ChartMetric, unitSystem: UnitSystem): string {
    return metric === 'avgRpe' ? 'RPE' : weightUnit(unitSystem);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useExerciseChart(
    habit: HabitWithLogs | undefined,
    exerciseId: number | null,
    metric: ChartMetric,
    range: TimeRange,
    unitSystem: UnitSystem = 'metric',
): ExerciseChartData {
    return useMemo(() => {
        const unit = getUnit(metric, unitSystem);
        const empty: ExerciseChartData = { data: [], unit, prCount: 0, allTimeMax: null };

        if (!habit || exerciseId == null) return empty;

        const cutoff = RANGE_CUTOFF[range]();
        const allPerfs = flattenPerformances(habit).filter(
            (p) => p.exerciseId === exerciseId,
        );

        if (allPerfs.length === 0) return empty;

        // Group by date
        const byDate = new Map<string, typeof allPerfs>();
        for (const perf of allPerfs) {
            if (cutoff && !isAfter(parseISO(perf.date), cutoff)) continue;
            if (!byDate.has(perf.date)) byDate.set(perf.date, []);
            byDate.get(perf.date)!.push(perf);
        }

        if (byDate.size === 0) return empty;

        // Aggregate per date
        const aggregated: { date: string; value: number }[] = [];

        for (const [date, perfs] of [...byDate.entries()].sort()) {
            let value: number | null = null;

            if (metric === 'maxWeight') {
                const weights = perfs.map((p) => p.weight).filter((w): w is number => w != null);
                value = weights.length ? Math.max(...weights) : null;
            } else if (metric === 'totalVolume') {
                value = perfs.reduce((sum, p) => {
                    if (p.weight == null || p.reps == null) return sum;
                    return sum + p.weight * p.reps;
                }, 0);
                if (value === 0) value = null;
            } else if (metric === 'estimatedOneRM') {
                const orms = perfs
                    .filter((p) => p.weight != null && p.reps != null && p.reps > 0)
                    .map((p) => epley1RM(p.weight!, p.reps!));
                value = orms.length ? Math.max(...orms) : null;
            } else if (metric === 'avgRpe') {
                const rpes = perfs.map((p) => p.rpe).filter((r): r is number => r != null);
                value = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
            }

            if (value != null) {
                aggregated.push({ date, value: Math.round(value * 10) / 10 });
            }
        }

        // PR detection — scan chronologically in kg, then convert to display unit
        let runningMax = -Infinity;
        const isWeight = metric !== 'avgRpe';
        const data: ChartDataPoint[] = aggregated.map(({ date, value }) => {
            const isPR = value > runningMax;
            if (isPR) runningMax = value;
            const displayValue = isWeight ? kgToDisplay(value, unitSystem) : value;
            return { date, value: displayValue, isPR };
        });

        const prCount = data.filter((d) => d.isPR).length;
        const allTimeMax = runningMax === -Infinity
            ? null
            : isWeight ? kgToDisplay(runningMax, unitSystem) : runningMax;

        return { data, unit, prCount, allTimeMax };
    }, [habit, exerciseId, metric, range, unitSystem]);
}