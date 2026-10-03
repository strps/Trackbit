import { useState, useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceDot,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/shared/utils/utils';
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue,
} from '@/shared/components/ui/select';
import type { HabitWithLogs } from '@/features/tracker/use-tracker';
import type { ExerciseWithLastPerformance } from '@/hooks/use-exercises';
import {
    useExerciseChart,
    type ChartMetric,
    type TimeRange,
} from '../hooks/use-exercise-chart';
import { useUnitSystem } from '@/providers/unit-system-provider';
import { useTranslation } from 'react-i18next';

// ── Constants ─────────────────────────────────────────────────────────────────

const METRICS = [
    { value: 'maxWeight', label: 'metric_max_weight' },
    { value: 'totalVolume', label: 'metric_volume' },
    { value: 'estimatedOneRM', label: 'metric_one_rm' },
    { value: 'avgRpe', label: 'metric_avg_rpe' },
] as const satisfies readonly { value: ChartMetric; label: string }[];

const RANGES = [
    { value: '1M', label: 'range_1m' },
    { value: '3M', label: 'range_3m' },
    { value: '6M', label: 'range_6m' },
    { value: '1Y', label: 'range_1y' },
    { value: 'all', label: 'range_all' },
] as const satisfies readonly { value: TimeRange; label: string }[];

// ── Sub-components ────────────────────────────────────────────────────────────

interface SegmentedControlProps<T extends string> {
    options: { value: T; label: string }[];
    value: T;
    onChange: (v: T) => void;
    className?: string;
}

function SegmentedControl<T extends string>({
    options, value, onChange, className,
}: SegmentedControlProps<T>) {
    return (
        <div className={cn('flex gap-0.5 bg-muted rounded-lg p-0.5', className)}>
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        'px-3 py-1 text-xs rounded-md transition-colors font-medium',
                        value === opt.value
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: { value: number; payload: { date: string; isPR: boolean } }[];
    unit: string;
}

const CustomTooltip = ({ active, payload, unit }: CustomTooltipProps) => {
    const { t } = useTranslation('analytics');
    if (!active || !payload?.length) return null;
    const { value, payload: point } = payload[0];
    return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-sm text-sm">
            <p className="text-muted-foreground text-xs mb-1">
                {format(parseISO(point.date), 'MMM d, yyyy')}
            </p>
            <p className="font-medium">
                {value} <span className="text-muted-foreground font-normal">{unit}</span>
            </p>
            {point.isPR && (
                <p className="text-amber-500 text-xs font-medium mt-0.5">{t('personal_record')}</p>
            )}
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

interface ExerciseChartProps {
    habit: HabitWithLogs;
    exercises: ExerciseWithLastPerformance[];
    className?: string;
}

export const ExerciseChart = ({ habit, exercises, className }: ExerciseChartProps) => {
    const { t } = useTranslation('analytics');
    const [metric, setMetric] = useState<ChartMetric>('maxWeight');
    const [range, setRange] = useState<TimeRange>('3M');
    const [exerciseId, setExerciseId] = useState<number | null>(
        exercises[0]?.id ?? null,
    );

    // Only show exercises that actually appear in this habit's logs
    const usedExerciseIds = useMemo(() => {
        const ids = new Set<number>();
        for (const dayLog of Object.values(habit.dayLogs)) {
            for (const session of dayLog.exerciseSessions ?? []) {
                for (const log of session.exerciseLogs) {
                    ids.add(log.exerciseId);
                }
            }
        }
        return ids;
    }, [habit]);

    const filteredExercises = useMemo(
        () => exercises.filter((e) => usedExerciseIds.has(e.id)),
        [exercises, usedExerciseIds],
    );

    const selectedExercise = filteredExercises.find((e) => e.id === exerciseId);
    const { unitSystem } = useUnitSystem();
    const { data, unit, prCount, allTimeMax } = useExerciseChart(habit, exerciseId, metric, range, unitSystem);

    const prPoints = data.filter((d) => d.isPR);

    // Colour based on trend — up is good for weight/volume/1RM, neutral for RPE
    const chartColor = metric === 'avgRpe' ? '#f59e0b' : '#3b82f6';

    if (filteredExercises.length === 0) {
        return (
            <div className={cn('rounded-xl border border-border p-8 text-center text-muted-foreground', className)}>
                {t('exercise_empty')}
            </div>
        );
    }

    return (
        <div className={cn('rounded-xl border border-border overflow-hidden', className)}>
            {/* Header */}
            <div className="p-6 pb-4 border-b flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-500 shrink-0" />
                    <Select
                        value={exerciseId != null ? String(exerciseId) : ''}
                        onValueChange={(v) => setExerciseId(Number(v))}
                    >
                        <SelectTrigger className="w-48 h-8 text-sm font-semibold border-none shadow-none px-1 focus:ring-0">
                            <SelectValue placeholder={t('exercise_select')} />
                        </SelectTrigger>
                        <SelectContent>
                            {filteredExercises.map((ex) => (
                                <SelectItem key={ex.id} value={String(ex.id)}>
                                    {ex.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <SegmentedControl
                        options={METRICS.map((m) => ({ ...m, label: t(m.label) }))}
                        value={metric}
                        onChange={setMetric}
                    />
                    <SegmentedControl
                        options={RANGES.map((r) => ({ ...r, label: t(r.label) }))}
                        value={range}
                        onChange={setRange}
                    />
                </div>
            </div>

            {/* Summary row */}
            {data.length > 0 && (
                <div className="px-6 pt-4 flex gap-6">
                    {allTimeMax != null && (
                        <div>
                            <p className="text-xs text-muted-foreground">{t('best_in_range')}</p>
                            <p className="text-lg font-semibold">
                                {allTimeMax}
                                <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
                            </p>
                        </div>
                    )}
                    <div>
                        <p className="text-xs text-muted-foreground">{t('prs_in_range')}</p>
                        <p className="text-lg font-semibold text-amber-500">{prCount}</p>
                    </div>
                    <div>
                        <p className="text-xs text-muted-foreground">{t('sessions')}</p>
                        <p className="text-lg font-semibold">{data.length}</p>
                    </div>
                </div>
            )}

            {/* Chart */}
            <div className="p-6 pt-4">
                {data.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                        {t('exercise_no_data', { name: selectedExercise?.name ?? '' })}
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chartColor} stopOpacity={0.15} />
                                    <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="hsl(var(--border))"
                                vertical={false}
                            />
                            <XAxis
                                dataKey="date"
                                tickFormatter={(d) => format(parseISO(d), 'MMM d')}
                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                tickLine={false}
                                minTickGap={40}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                tickLine={false}
                                width={36}
                                tickFormatter={(v) => `${v}`}
                            />
                            <Tooltip content={<CustomTooltip unit={unit} />} />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={chartColor}
                                strokeWidth={2}
                                fill="url(#chartGrad)"
                                dot={false}
                                activeDot={{ r: 4, strokeWidth: 0, fill: chartColor }}
                            />
                            {/* PR markers */}
                            {prPoints.map((point) => (
                                <ReferenceDot
                                    key={point.date}
                                    x={point.date}
                                    y={point.value}
                                    r={5}
                                    fill="#f59e0b"
                                    stroke="hsl(var(--background))"
                                    strokeWidth={2}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};