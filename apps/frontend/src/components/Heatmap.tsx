// components/Heatmap.tsx (or wherever you place it)

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { mapValueToCSSrgba } from "../lib/colorUtils";
import { ColorStop } from "@trackbit/types";
import React, { useMemo, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
    format,
    addDays,
    isAfter,
    subWeeks,
    eachWeekOfInterval,
    getDay,
} from "date-fns";

interface HeatmapProps {
    /** Map of date strings (YYYY-MM-DD) to numeric values */
    data?: Record<string, number>;
    /** Minimum value for color scaling */
    minValue?: number;
    /** Maximum value for color scaling (e.g., daily goal) */
    maxValue?: number;
    /** Gradient stops for coloring */
    colorStops?: ColorStop[];
    /** Currently selected date (YYYY-MM-DD) */
    selectedDate?: string;
    /** Callback when a date cell is selected */
    onDateSelect?: (date: string) => void;
    /** Today's date (YYYY-MM-DD); defaults to current date */
    today?: string;
    /** Number of weeks to display */
    numWeeks?: number;
    /** First day of the week */
    weekStart?: "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
    /** Show navigation controls */
    showNavigation?: boolean;
    /** Show color legend */
    showLegend?: boolean;
    /** Show header section */
    showHeader?: boolean;
    /** Header title */
    title?: string;
    /** Pre-computed weeks array (overrides internal calculation) */
    weeks?: Date[][];
    /** Whether to render future days (grayed or hidden) */
    showFutureDays?: boolean;
    /** Custom cell renderer */
    renderCell?: (props: DateCellProps) => React.ReactNode;
    /** Custom tooltip content renderer */
    renderTooltipContent?: (date: string, value: number) => React.ReactNode;
    /** Classname */
    className?: string;
}

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const Heatmap = ({
    data = {},
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
    weekStart = "Mon",
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

    // Compute weeks if not provided via prop
    const computedWeeks = useMemo<Date[][]>(() => {
        if (propWeeks) return propWeeks;

        const endDate = new Date(today);
        const startDate = subWeeks(endDate, numWeeks - 1);

        const weekStarts = eachWeekOfInterval(
            { start: startDate, end: endDate },
            { weekStartsOn: weekDays.indexOf(weekStart) as 0 | 1 | 2 | 3 | 4 | 5 | 6 }
        );

        return weekStarts.map((weekStartDate) =>
            Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i))
        );
    }, [propWeeks, today, numWeeks, weekStart]);

    const weeks = computedWeeks;

    // Rotate weekday labels according to weekStart
    const weekDaysLabels = useMemo(() => {
        const startIdx = weekDays.indexOf(weekStart);
        return [...weekDays.slice(startIdx), ...weekDays.slice(0, startIdx)];
    }, [weekStart]);

    // Group weeks by month for spanning month labels
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
        const raw = data[dateStr] ?? 0;
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
        const newDate = addDays(new Date(selectedDate), offset);
        const newDateStr = format(newDate, "yyyy-MM-dd");
        if (!showFutureDays && isAfter(newDate, new Date(today))) return;
        onDateSelect(newDateStr);
    };

    // Auto-scroll to selected week
    useEffect(() => {
        if (selectedDate && scrollRef.current) {
            const weekIndex = weeks.findIndex((week) =>
                week.some((d) => format(d, "yyyy-MM-dd") === selectedDate)
            );
            if (weekIndex !== -1) {
                const cellWidth = 16; // w-3 (12px) + gap-1 (4px)
                scrollRef.current.scrollLeft = weekIndex * cellWidth - scrollRef.current.offsetWidth / 2;
            }
        }
    }, [selectedDate, weeks]);

    const displayDate = selectedDate
        ? format(new Date(selectedDate), "EEEE, MMMM do")
        : "Select a date";

    const isTodaySelected = selectedDate === today;

    if (weeks.length === 0) {
        return <div className="p-4 text-center text-muted-foreground">No data available</div>;
    }

    return (
        <div className={cn("rounded-xl shadow-lg border border-border overflow-hidden flex flex-col", className)}>
            {showHeader && (
                <div className="p-6 pb-2 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
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

                    {showLegend && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Less</span>
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                                const val = minValue + ratio * (maxValue - minValue);
                                return (
                                    <div key={ratio} className={dateCellBaseClassName}>
                                        <div
                                            className="w-full h-full rounded-[25%]"
                                            style={{ backgroundColor: getColorForValue(val) }}
                                        />
                                    </div>
                                );
                            })}
                            <span>More</span>
                        </div>
                    )}
                </div>
            )}

            <div className="w-full grid grid-cols-[auto_1fr] gap-2 p-4" role="grid" aria-label="Heatmap calendar">
                {/* Weekday labels */}
                <div className="flex flex-col shrink-0 justify-end gap-1.5 pt-6 pb-0.5 pr-2 text-[10px] font-bold text-muted-foreground leading-3">
                    {weekDaysLabels.map((label) => (
                        <span key={label} className="h-3">
                            {label}
                        </span>
                    ))}
                </div>

                <ScrollArea className="min-w-0">
                    <div ref={scrollRef}>
                        {/* Month labels with spanning */}
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(0,1fr))] gap-1 mb-2 h-4">
                            {monthGroups.map((group) => (
                                <div
                                    key={group.label}
                                    className="text-[10px] font-bold text-muted-foreground"
                                    style={{ gridColumn: `${group.startIndex + 1} / span ${group.span}` }}
                                >
                                    {group.label}
                                </div>
                            ))}
                        </div>

                        {/* Day cells */}
                        <div className="flex gap-1">
                            {weeks.map((week, weekIdx) => (
                                <div key={weekIdx} className="flex flex-col gap-1">
                                    {week.map((date) => {
                                        const dateStr = format(date, "yyyy-MM-dd");
                                        const value = getValue(dateStr);
                                        const isSelected = selectedDate === dateStr;
                                        const isToday = dateStr === today;
                                        const isFuture = isAfter(date, new Date(today));

                                        if (isFuture && !showFutureDays) {
                                            return <div key={dateStr} className="w-3 h-3" />;
                                        }

                                        const color = getColorForValue(value);

                                        const cellProps: DateCellProps = {
                                            color,
                                            value,
                                            isSelected,
                                            isToday,
                                            onClick: () => onDateSelect?.(dateStr),
                                            dateStr,
                                            renderTooltipContent,
                                        };

                                        return renderCell ? (
                                            <React.Fragment key={dateStr}>{renderCell(cellProps)}</React.Fragment>
                                        ) : (
                                            <DateCell key={dateStr} {...cellProps} />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>
        </div>
    );
};

interface DateCellProps {
    color: string;
    value: number;
    isSelected: boolean;
    isToday: boolean;
    onClick?: () => void;
    dateStr: string;
    renderTooltipContent?: (date: string, value: number) => React.ReactNode;
}

export const dateCellBaseClassName =
    "w-3 h-3 rounded-[25%] border border-border shadow-sm bg-muted/25";

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
                <div
                    className={cn(
                        dateCellBaseClassName,
                        isSelected && "z-10 scale-125 shadow-md ring-1 ring-primary border-primary",
                        isToday && "ring-1 ring-primary z-10",
                        "hover:scale-125 hover:z-20 hover:shadow-md cursor-pointer transition-all"
                    )}
                    onClick={onClick}
                    role="gridcell"
                    aria-label={`${dateStr}, ${value} units`}
                >
                    <div className="w-full h-full rounded-[25%]" style={{ backgroundColor: color }} />
                </div>
            </TooltipTrigger>
            <TooltipContent>{tooltipContent}</TooltipContent>
        </Tooltip>
    );
};