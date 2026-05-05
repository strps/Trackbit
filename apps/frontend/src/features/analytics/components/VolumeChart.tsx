import { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend,
    Line, ComposedChart, ReferenceLine,
} from 'recharts';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/shared/utils/utils';
import { Button } from '@/shared/components/ui/button';
import { SegmentedControl } from './SegmentedControl';
import type { HabitWithLogs } from '@/features/tracker/use-tracker';
import type { ExerciseWithLastPerformance } from '@/hooks/use-exercises';
import {
    useVolumeChart,
    EXERCISE_COLORS,
    type VolumeBreakdown,
} from '../hooks/use-volume-chart';
import type { TimeRange } from '../hooks/use-exercise-chart';
import { useUnitSystem } from '@/providers/unit-system-provider';
import { kgToDisplay, weightUnit, formatNumber } from '@/shared/utils/intlFormatter';
import { useTranslation } from 'react-i18next';

// ── Constants ─────────────────────────────────────────────────────────────────

const RANGES: { value: TimeRange; label: string }[] = [
    { value: '1M', label: '1M' },
    { value: '3M', label: '3M' },
    { value: '6M', label: '6M' },
    { value: '1Y', label: '1Y' },
    { value: 'all', label: 'All' },
];

const BREAKDOWN_OPTIONS: { value: VolumeBreakdown; label: string }[] = [
    { value: 'total', label: 'Total' },
    { value: 'stacked', label: 'By exercise' },
];

// ── Custom tooltip ────────────────────────────────────────────────────────────

interface TooltipPayloadItem {
    name: string;
    value: number;
    color: string;
    dataKey: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipPayloadItem[];
    label?: string;
    breakdown: VolumeBreakdown;
    showRpe: boolean;
    exerciseMap: Map<number, string>;
    unit: string;
    locale: string;
}

const CustomTooltip = ({
    active, payload, label, breakdown, showRpe, exerciseMap, unit, locale,
}: CustomTooltipProps) => {
    if (!active || !payload?.length) return null;

    const rpeItem = payload.find((p) => p.dataKey === 'avgRpe');
    const volItems = payload.filter((p) => p.dataKey !== 'avgRpe' && p.value > 0);

    return (
        <div className="bg-popover border border-border rounded-lg px-3 py-2 shadow-sm text-sm min-w-32">
            <p className="text-muted-foreground text-xs mb-2 font-medium">{label}</p>
            {breakdown === 'stacked'
                ? volItems.map((item) => {
                    const exId = parseInt(item.dataKey.replace('ex_', ''));
                    return (
                        <div key={item.dataKey} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ background: item.color }}
                                />
                                <span className="text-muted-foreground text-xs truncate max-w-28">
                                    {exerciseMap.get(exId) ?? `Ex ${exId}`}
                                </span>
                            </div>
                            <span className="font-medium tabular-nums">{formatNumber(item.value, locale)} {unit}</span>
                        </div>
                    );
                })
                : (
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-muted-foreground text-xs">Volume</span>
                        <span className="font-medium tabular-nums">
                            {formatNumber(volItems[0]?.value ?? 0, locale)} {unit}
                        </span>
                    </div>
                )
            }
            {showRpe && rpeItem?.value != null && (
                <div className="flex items-center justify-between gap-4 mt-1 pt-1 border-t border-border">
                    <span className="text-muted-foreground text-xs">Avg RPE</span>
                    <span className="font-medium tabular-nums text-amber-500">{rpeItem.value}</span>
                </div>
            )}
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

interface VolumeChartProps {
    habit: HabitWithLogs;
    exercises: ExerciseWithLastPerformance[];
    className?: string;
}

export const VolumeChart = ({ habit, exercises, className }: VolumeChartProps) => {
    const [range, setRange] = useState<TimeRange>('3M');
    const [breakdown, setBreakdown] = useState<VolumeBreakdown>('total');
    const [showRpe, setShowRpe] = useState(false);

    const { unitSystem } = useUnitSystem();
    const { i18n } = useTranslation();
    const locale = i18n.language;
    const unit = weightUnit(unitSystem);

    const { weeks: rawWeeks, exerciseIds, totalVolume: totalVolumeKg, avgRpe, peakWeek } =
        useVolumeChart(habit, range, exercises);

    const weeks = useMemo(() =>
        rawWeeks.map((w) => {
            const converted: Record<string, unknown> = { week: w.week, weekKey: w.weekKey, avgRpe: w.avgRpe };
            converted.total = kgToDisplay(w.total as number, unitSystem);
            for (const id of exerciseIds) {
                converted[`ex_${id}`] = kgToDisplay((w[`ex_${id}`] as number) ?? 0, unitSystem);
            }
            return converted as typeof w;
        }),
        [rawWeeks, unitSystem, exerciseIds],
    );

    const totalVolume = kgToDisplay(totalVolumeKg, unitSystem);

    const exerciseMap = new Map(exercises.map((e) => [e.id, e.name]));

    const peakWeekLabel = weeks.find((w) => w.weekKey === peakWeek)?.week ?? null;

    const tickFormatter = (v: number) =>
        v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v);

    if (weeks.length === 0) {
        return (
            <div className={cn('rounded-xl border border-border p-8 text-center text-muted-foreground', className)}>
                No volume data for this habit in the selected range.
            </div>
        );
    }

    return (
        <div className={cn('rounded-xl border border-border overflow-hidden', className)}>
            {/* Header */}
            <div className="p-6 pb-4 border-b flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="font-semibold text-sm">Weekly volume</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant={showRpe ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setShowRpe((v) => !v)}
                    >
                        RPE overlay
                    </Button>
                    <SegmentedControl
                        options={BREAKDOWN_OPTIONS}
                        value={breakdown}
                        onChange={setBreakdown}
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
                <div>
                    <p className="text-xs text-muted-foreground">Total volume</p>
                    <p className="text-lg font-semibold">
                        {totalVolume >= 1000
                            ? `${(totalVolume / 1000).toFixed(1)}k`
                            : formatNumber(totalVolume, locale)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>
                    </p>
                </div>
                {avgRpe != null && (
                    <div>
                        <p className="text-xs text-muted-foreground">Avg RPE</p>
                        <p className="text-lg font-semibold text-amber-500">{avgRpe}</p>
                    </div>
                )}
                {peakWeekLabel && (
                    <div>
                        <p className="text-xs text-muted-foreground">Peak week</p>
                        <p className="text-lg font-semibold">{peakWeekLabel}</p>
                    </div>
                )}
                <div>
                    <p className="text-xs text-muted-foreground">Weeks tracked</p>
                    <p className="text-lg font-semibold">{weeks.length}</p>
                </div>
            </div>

            {/* Chart */}
            <div className="p-6 pt-4">
                <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={weeks} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="week"
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={32}
                        />
                        {/* Left axis — volume */}
                        <YAxis
                            yAxisId="vol"
                            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                            tickFormatter={tickFormatter}
                        />
                        {/* Right axis — RPE, only rendered when overlay is on */}
                        {showRpe && (
                            <YAxis
                                yAxisId="rpe"
                                orientation="right"
                                domain={[0, 10]}
                                ticks={[2, 4, 6, 8, 10]}
                                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                                axisLine={false}
                                tickLine={false}
                                width={28}
                            />
                        )}
                        <Tooltip
                            content={
                                <CustomTooltip
                                    breakdown={breakdown}
                                    showRpe={showRpe}
                                    exerciseMap={exerciseMap}
                                    unit={unit}
                                    locale={locale}
                                />
                            }
                        />
                        {breakdown === 'stacked'
                            ? exerciseIds.map((exId, idx) => (
                                <Bar
                                    key={exId}
                                    yAxisId="vol"
                                    dataKey={`ex_${exId}`}
                                    stackId="vol"
                                    fill={EXERCISE_COLORS[idx % EXERCISE_COLORS.length]}
                                    radius={idx === exerciseIds.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                                    maxBarSize={40}
                                    name={exerciseMap.get(exId) ?? `Ex ${exId}`}
                                />
                            ))
                            : (
                                <Bar
                                    yAxisId="vol"
                                    dataKey="total"
                                    fill="#10b981"
                                    radius={[3, 3, 0, 0]}
                                    maxBarSize={40}
                                    name="Volume"
                                />
                            )
                        }
                        {/* RPE overlay line */}
                        {showRpe && (
                            <Line
                                yAxisId="rpe"
                                type="monotone"
                                dataKey="avgRpe"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                                connectNulls
                                name="Avg RPE"
                            />
                        )}
                        {/* Legend only in stacked mode */}
                        {breakdown === 'stacked' && exerciseIds.length > 1 && (
                            <Legend
                                formatter={(value) => (
                                    <span style={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}>
                                        {value}
                                    </span>
                                )}
                            />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};