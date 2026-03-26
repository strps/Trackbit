// components/Heatmap.tsx (updated with full grid alignment for weekday labels)

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { mapValueToCSSrgba } from "@/shared/utils/colorUtils";
import { ColorStop } from "@trackbit/types";
import React, { useMemo, useEffect, useRef } from "react";
import { cn } from "@/shared/utils/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/shared/components/ui/scroll-area";
import {
    format,
    addDays,
    isAfter,
    subWeeks,
    eachWeekOfInterval,
} from "date-fns";
import { Button } from "./ui/button";

interface HeatmapProps {
    // data?: Record<string, { rating: number }>;
    getRating?: (date: string) => number;
    minValue?: number;
    maxValue?: number;
    colorStops?: ColorStop[];
    selectedDate?: string;
    onDateSelect?: (date: string) => void;
    today?: string;
    numWeeks?: number;
    weekStart?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    showNavigation?: boolean;
    showLegend?: boolean;
    showHeader?: boolean;
    title?: string;
    weeks?: Date[][];
    showFutureDays?: boolean;
    renderCell?: (props: DateCellProps) => React.ReactNode;
    renderTooltipContent?: (date: string, value: number) => React.ReactNode;
    className?: string;
}

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const Heatmap = ({
    // data = {},
    getRating,
    minValue = 0,
    maxValue = 1,
    colorStops = [
        { position: 0, color: [16, 185, 249, 0] },
        { position: 1, color: [16, 185, 129, 1] },
    ],
    selectedDate,
    onDateSelect,
    today = format(new Date(), "yyyy-MM-dd"),
    numWeeks = 52,
    weekStart = 1,
    showNavigation = true,
    showLegend = true,
    showHeader = true,
    title = "Heatmap",
    weeks: propWeeks,
    showFutureDays = false,
    renderCell,
    renderTooltipContent,
    className,
}: HeatmapProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const computedWeeks = useMemo<Date[][]>(() => {
        if (propWeeks) return propWeeks;

        const endDate = new Date(today);
        const startDate = subWeeks(endDate, numWeeks - 1);
        const weekStarts = eachWeekOfInterval(
            { start: startDate, end: endDate },
            { weekStartsOn: weekStart, },

        );
        return weekStarts.map((weekStartDate) =>
            Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i))
        );
    }, [propWeeks, today, numWeeks, weekStart]);

    const weeks = computedWeeks;

    const weekDaysLabels = useMemo(() => {
        return [...weekDays.slice(weekStart), ...weekDays.slice(0, weekStart)];
    }, [weekStart]);

    const monthGroups = useMemo(() => {
        const groups: { label: string; span: number; startIndex: number }[] = [];
        let currentMonth = "";
        let currentSpan = 0;
        let currentStart = 0;

        weeks.forEach((week, idx) => {
            const monthLabel = format(week[0], "MMM");
            if (monthLabel !== currentMonth) {
                if (currentMonth) {
                    groups.push({ label: currentMonth, span: currentSpan, startIndex: currentStart });
                }
                currentMonth = monthLabel;
                currentSpan = 1;
                currentStart = idx;
            } else {
                currentSpan++;
            }
        });
        if (currentMonth) {
            groups.push({ label: currentMonth, span: currentSpan, startIndex: currentStart });
        }
        return groups;
    }, [weeks]);

    const getValue = (dateStr: string): number => {
        const raw = getRating ? getRating(dateStr) : 0;
        return Math.max(minValue, Math.min(maxValue, raw));
    };

    const getNormalizedProgress = (value: number): number => {
        const range = maxValue - minValue;
        return range > 0 ? (value - minValue) / range : 0;
    };

    const getColorForValue = (value: number): string => {
        const progress = getNormalizedProgress(value);
        return mapValueToCSSrgba(progress, 0, 1, colorStops);
    };

    const handleDateChange = (offset: number) => {
        if (!selectedDate || !onDateSelect) return;
        const newDate = addDays(new Date(selectedDate + 'T00:00:00.000'), offset);
        const newDateStr = format(newDate, "yyyy-MM-dd");
        if (!showFutureDays && isAfter(newDate, new Date(today))) return;
        onDateSelect(newDateStr);
    };

    useEffect(() => {
        const scrollArea: HTMLDivElement | null | undefined = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]')
        if (selectedDate && scrollArea) {
            const weekIndex = weeks.findIndex((week) =>
                week.some((d) => format(d, "yyyy-MM-dd") === selectedDate)
            );
            if (weekIndex !== -1) {
                const cellWidth = 16;
                scrollArea.scrollTo({
                    top: 0,
                    left: weekIndex * cellWidth - scrollArea.offsetWidth / 2,
                    behavior: 'smooth'
                });
            }
        }
    }, [selectedDate, weeks]);

    const displayDate = selectedDate
        ? format(selectedDate + 'T00:00:00.000', "PPPP")
        : "Select a date";


    const isTodaySelected = selectedDate === today;


    if (weeks.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">No data available</div>;
    }


    return (
        <div className={cn("rounded-xl shadow-lg border border-border overflow-hidden flex flex-col", className)}>
            {showHeader && (
                <div className="p-6 pb-2 border-b flex flex-wrap justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-slate-400" />
                            {title}
                        </h2>
                    </div>

                    {showNavigation && (
                        <div className="flex items-center gap-3">
                            <div className="flex border h-10 w-64 items-center justify-between gap-2 border-border rounded-md overflow-hidden shadow-sm">
                                <button
                                    onClick={() => handleDateChange(-1)}
                                    className="h-full aspect-square flex items-center justify-center border-r"
                                    aria-label="Previous day"
                                >
                                    <ChevronLeft className="w-3 h-3" />
                                </button>
                                <p className="text-sm text-slate-500 font-medium mt-1">{displayDate}</p>
                                <button
                                    onClick={() => handleDateChange(1)}
                                    disabled={isTodaySelected && !showFutureDays}
                                    className="h-full aspect-square flex items-center justify-center border-l"
                                    aria-label="Next day"
                                >
                                    <ChevronRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    )}

                    {showLegend && <GradientPreview stops={colorStops} showLabel />}
                </div>
            )}

            {/* Full grid container */}
            <ScrollArea className="py-4 px-12 mb-4 h-41" ref={scrollRef}>
                <div
                    className="grid gap-1 w-max m-auto px-1"
                    style={{
                        gridTemplateColumns: `min-content repeat(${weeks.length}, minmax(0, 0.75em))`,
                        gridTemplateRows: "auto  repeat(7, minmax(0, 0.75em))",
                    }}
                    role="grid"
                    aria-label="Heatmap calendar"
                >
                    {/* Empty top-left corner */}
                    <div />

                    {/* Month labels row – spanning across weeks */}
                    {monthGroups.map((group, i) => (
                        <div
                            key={group.label + i}
                            className="text-[10px] font-bold text-muted-foreground pb-"
                            style={{
                                gridColumn: `${group.startIndex + 2} / span ${group.span}`,
                                gridRow: "1",
                            }}
                        >
                            {group.label}
                        </div>
                    ))}

                    {/* Weekday labels overlay */}
                    <div
                        className="bg-linear-to-r from-background from-50% to-transparent w-full h-full sticky left-0"
                        style={{ gridRow: "1 / 9", gridColumn: 1 }}
                    >
                        <div />
                    </div>
                    {/* Weekday labels – fixed left column */}
                    {weekDaysLabels.map((label, dayIdx) => (
                        <div
                            key={label}
                            className="sticky left-0 text-[10px] font-bold text-muted-foreground text-right pr-2 flex items-center justify-end"
                            style={{ gridRow: dayIdx + 2, gridColumn: 1 }}
                        >
                            {label}
                        </div>
                    ))}
                    {/* Day cells */}
                    {weeks.map((week, weekIdx) =>
                        week.map((date, dayIdx) => {
                            const dateStr = format(date.toUTCString(), "yyyy-MM-dd");

                            const value = getValue(dateStr);
                            const isSelected = selectedDate === dateStr;
                            const isToday = dateStr === today;
                            const isFuture = isAfter(date, addDays(new Date(today), 1));

                            if (isFuture && !showFutureDays) {
                                return
                            }

                            const color = getColorForValue(value);

                            const cellProps: DateCellProps = {
                                color,
                                value,
                                isSelected,
                                isToday,
                                onClick: () => {
                                    onDateSelect?.(dateStr)
                                }
                                ,
                                dateStr,
                                renderTooltipContent,
                            };

                            return (
                                <div
                                    key={dateStr}
                                    style={{
                                        gridRow: dayIdx + 2,
                                        gridColumn: weekIdx + 2,
                                    }}
                                >
                                    {renderCell ? renderCell(cellProps) : <DateCell {...cellProps} />}
                                </div>
                            );
                        })
                    )}

                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
};

/* Rest of the component (DateCell, BaseCell, GradientPreview) remains unchanged */
interface DateCellProps {
    color: string;
    value: number;
    isSelected: boolean;
    isToday: boolean;
    onClick?: () => void;
    dateStr: string;
    renderTooltipContent?: (date: string, value: number) => React.ReactNode;
}

export const DateCell = ({
    color,
    value,
    isSelected,
    isToday,
    onClick,
    dateStr,
    renderTooltipContent,
}: DateCellProps) => {
    const defaultContent = `${dateStr}: ${value} unit${value !== 1 ? "s" : ""}`;
    const tooltipContent = renderTooltipContent
        ? renderTooltipContent(dateStr, value)
        : defaultContent;

    return (
        <Tooltip delayDuration={600}>
            <TooltipTrigger asChild>
                <BaseCell
                    className={cn(
                        baseCellClassName,
                        isSelected && "z-10 scale-125 shadow-md ring-1 ring-primary border-primary",
                        isToday && "ring-1 ring-primary z-10",
                        "hover:scale-125 hover:z-20 hover:shadow-md cursor-pointer transition-all"
                    )}
                    onClick={onClick}
                    role="gridcell"
                    aria-label={`${dateStr}, ${value} units`}
                    color={color}
                />
            </TooltipTrigger>
            <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>
    );
};

type CellSize = 'sm' | 'md' | 'lg';

interface BaseCellProps extends React.HTMLProps<HTMLDivElement> {
    color: string;
    cellSize?: CellSize;
}

export const baseCellClassName =
    "w-3 h-3 rounded-[25%] border border-border shadow-sm bg-muted/25";

export const BaseCell = ({ color, cellSize = 'sm', className, ...restProps }: BaseCellProps) => {
    const size = {
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5',
    };

    return (
        <div
            className={cn(
                `${size[cellSize]} rounded-[25%] border border-border shadow-sm bg-muted/25`,
                className
            )}
            {...restProps}
        >
            <div className="w-full h-full rounded-[25%]" style={{ backgroundColor: color }} />
        </div>
    );
};

interface GradientPreviewProps {
    stops: ColorStop[];
    showLabel?: boolean;
    cellSize?: CellSize;
    className?: string;
}

export const GradientPreview = ({ stops, showLabel, cellSize = 'sm', className }: GradientPreviewProps) => (
    <div className={cn("flex gap-2 items-center text-xs text-muted-foreground", className)}>
        {showLabel && <span>Less</span>}
        <BaseCell cellSize={cellSize} color={mapValueToCSSrgba(0, 0, 1, stops)} />
        <BaseCell cellSize={cellSize} color={mapValueToCSSrgba(0.25, 0, 1, stops)} />
        <BaseCell cellSize={cellSize} color={mapValueToCSSrgba(0.50, 0, 1, stops)} />
        <BaseCell cellSize={cellSize} color={mapValueToCSSrgba(0.75, 0, 1, stops)} />
        <BaseCell cellSize={cellSize} color={mapValueToCSSrgba(1, 0, 1, stops)} />
        {showLabel && <span>More</span>}
    </div>
);