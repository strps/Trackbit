import { useState } from 'react';
import {
    RadarChart, Radar, PolarGrid, PolarAngleAxis,
    PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { Activity } from 'lucide-react';
import { cn } from '@/shared/utils/utils';
import { SegmentedControl } from './SegmentedControl';
import type { HabitWithLogs } from '@/features/tracker/use-tracker';
import type { ExerciseWithLastPerformance } from '@/hooks/use-exercises';
import { useMuscleChart, type MuscleMetric } from '../hooks/use-muscle-chart';
import type { TimeRange } from '../hooks/use-exercise-chart';

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGES: { value: TimeRange; label: string }[] = [
    { value: '1M', label: '1M' },
    { value: '3M', label: '3M' },
    { value: '6M', label: '6M' },
    { value: '1Y', label: '1Y' },
    { value: 'all', label: 'All' },
];

const METRIC_OPTIONS: { value: MuscleMetric; label: string }[] = [
    { value: 'volume', label: 'Volume' },
    { value: 'frequency', label: 'Frequency' },
];

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface CustomTooltipProps {
    active?: boolean;
    payload?: { payload: { muscle: string; value: number; normalised: number } }[];
    metric: MuscleMetric;
}

const CustomTooltip = ({ active, payload, metric }: CustomTooltipProps) => {
    if (!active || !payload?.length) return null;
    const { muscle, value } = payload[0].payload;
    return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-sm text-sm">
            <p className="font-medium">{muscle}</p>
            <p className="text-muted-foreground text-xs mt-0.5">
                {metric === 'volume'
                    ? `${value.toLocaleString()} kg`
                    : `${value} session${value !== 1 ? 's' : ''}`}
            </p>
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

interface MuscleChartProps {
    habit: HabitWithLogs;
    exercises: ExerciseWithLastPerformance[];
    className?: string;
}

export const MuscleChart = ({ habit, exercises, className }: MuscleChartProps) => {
    const [range, setRange] = useState<TimeRange>('3M');
    const [metric, setMetric] = useState<MuscleMetric>('volume');

    const { points, topMuscle, neglectedMuscle, maxValue } =
        useMuscleChart(habit, range, metric, exercises);

    if (points.length === 0) {
        return (
            <div className={cn('rounded-xl border border-border p-8 text-center text-muted-foreground text-sm', className)}>
                No muscle group data available. Make sure your exercises have muscle groups assigned.
            </div>
        );
    }

    // Radar needs at least 3 axes to render meaningfully
    const hasEnoughAxes = points.length >= 3;

    return (
        <div className={cn('rounded-xl border border-border overflow-hidden', className)}>
            {/* Header */}
            <div className="p-6 pb-4 border-b flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-purple-500 shrink-0" />
                    <span className="font-semibold text-sm">Muscle group balance</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <SegmentedControl
                        options={METRIC_OPTIONS}
                        value={metric}
                        onChange={setMetric}
                    />
                    <SegmentedControl
                        options={RANGES}
                        value={range}
                        onChange={setRange}
                    />
                </div>
            </div>

            {/* Summary row */}
            <div className="px-6 pt-4 flex gap-6 flex-wrap">
                {topMuscle && (
                    <div>
                        <p className="text-xs text-muted-foreground">Most trained</p>
                        <p className="text-base font-semibold text-purple-500">{topMuscle}</p>
                    </div>
                )}
                {neglectedMuscle && neglectedMuscle !== topMuscle && (
                    <div>
                        <p className="text-xs text-muted-foreground">Least trained</p>
                        <p className="text-base font-semibold text-muted-foreground">{neglectedMuscle}</p>
                    </div>
                )}
                <div>
                    <p className="text-xs text-muted-foreground">Muscle groups</p>
                    <p className="text-base font-semibold">{points.length}</p>
                </div>
                <div>
                    <p className="text-xs text-muted-foreground">
                        {metric === 'volume' ? 'Peak volume' : 'Peak frequency'}
                    </p>
                    <p className="text-base font-semibold">
                        {metric === 'volume'
                            ? `${maxValue >= 1000 ? `${(maxValue / 1000).toFixed(1)}k` : maxValue} kg`
                            : `${maxValue} sessions`}
                    </p>
                </div>
            </div>

            {/* Chart */}
            <div className="p-6 pt-2">
                {!hasEnoughAxes ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm text-center px-4">
                        At least 3 muscle groups are needed to render the radar chart.
                        <br />Add more muscle groups to your exercises.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <RadarChart data={points} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                            <PolarGrid
                                stroke="hsl(var(--border))"
                                strokeDasharray="3 3"
                            />
                            <PolarAngleAxis
                                dataKey="muscle"
                                tick={{
                                    fontSize: 11,
                                    fill: 'hsl(var(--muted-foreground))',
                                }}
                            />
                            <PolarRadiusAxis
                                angle={90}
                                domain={[0, 100]}
                                tick={false}
                                axisLine={false}
                            />
                            <Radar
                                dataKey="normalised"
                                stroke="#8b5cf6"
                                fill="#8b5cf6"
                                fillOpacity={0.18}
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#8b5cf6', strokeWidth: 0 }}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                            />
                            <Tooltip content={<CustomTooltip metric={metric} />} />
                        </RadarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};