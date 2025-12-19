import { Activity, CalendarDays, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "./utils";
import { mapValueToCSSrgb } from "../../lib/colorUtils";
import { useHabitLogs } from "@/hooks/use-habit-logs";
import { ColorStop } from "@trackbit/types"

interface HeatmapProps {
    weeks: Date[][];
    todayStr: string;
    weekStart?: 'monday' | 'sunday'; // New prop
}

export const Heatmap = ({
    weeks,
    todayStr,
    weekStart = 'monday' // Default to monday
}: HeatmapProps) => {

    const { currentHabit, selectedDay, setDay: setSelectedDay } = useHabitLogs();
    const logsMap = currentHabit?.dayLogs || {};

    const getRating = (date: string) => {
        return currentHabit?.type === 'complex' ?
            logsMap[date]?.exerciseSessions?.reduce(
                (a, c) => a + (c.exerciseLogs?.length || 0)
                , 0)
            :
            logsMap[date]?.rating || 0;
    }

    // 1. Color Logic
    const dailyTarget = currentHabit?.dailyGoal || 1;
    const palette: ColorStop[] = currentHabit?.colorStops || [
        { position: 0, color: [241, 245, 249] },
        { position: 1, color: [16, 185, 129] }
    ];

    const getColorForValue = (val: number) => {
        return mapValueToCSSrgb(val, 0, dailyTarget, palette);
    };

    // 2. Navigation Logic
    const handleDateChange = (direction: 'up' | 'down') => {
        if (!selectedDay) return;

        const current = new Date(selectedDay);
        // Visual mapping: Up = Previous Day (Mon <- Tue), Down = Next Day (Mon -> Tue)
        const offset = direction === 'up' ? -1 : 1;
        current.setDate(current.getDate() + offset);

        const newDateStr = formatDate(current);

        // Prevent navigating into the future
        if (newDateStr > todayStr) return;

        setSelectedDay(newDateStr);
    };

    // 3. Month Label Logic
    const getMonthLabel = (weekIndex: number, weekDates: Date[]) => {
        const firstDayOfWeek = weekDates[0];
        const prevWeekFirstDay = weeks[weekIndex - 1]?.[0];

        if (!prevWeekFirstDay) {
            return firstDayOfWeek.toLocaleDateString('en-US', { month: 'short' });
        }

        if (firstDayOfWeek.getMonth() !== prevWeekFirstDay.getMonth()) {
            return firstDayOfWeek.toLocaleDateString('en-US', { month: 'short' });
        }

        return null;
    };

    // 4. Weekday Labels Logic
    const getDayLabels = () => {
        if (weekStart === 'sunday') {
            return ['Sun', '', 'Tue', '', 'Thu', '', ''];
        }
        // Default Monday
        return ['Mon', '', 'Wed', '', 'Fri', '', ''];
    };

    const displayDate = selectedDay
        ? new Date(selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
        : 'Select a date';

    const isTodaySelected = selectedDay === todayStr;

    return (
        <div className="rounded-xl shadow-lg border border-border overflow-hidden flex flex-col">

            {/* Header / Controls */}
            <div className="p-6 pb-2 border-b  flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

                <div>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-slate-400" />
                        Habit Logs
                    </h2>

                </div>

                <div className="flex items-center gap-3">
                    {/* Date Navigation Handles */}
                    <div className="flex border h-10 w-64 items-center justify-between gap-2 border-border  rounded-md overflow-hidden shadow-sm">
                        <button
                            onClick={() => handleDateChange('up')}
                            className="h-full aspect-square flex items-center justify-center border-r"
                            title="Previous Day"
                        >
                            <ChevronLeft className="w-3 h-3" />
                        </button>
                        <p className="text-sm text-slate-500 font-medium mt-1">
                            {displayDate}
                        </p>
                        <button
                            onClick={() => handleDateChange('down')}
                            disabled={isTodaySelected}
                            className="h-full aspect-square flex items-center justify-center border-l"
                            title="Next Day"
                        >
                            <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>


                </div>

                {/* Legend */}
                <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>Less</span>
                    {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                        const val = Math.ceil(dailyTarget * ratio);
                        return (
                            <div
                                key={ratio}
                                className="w-3 h-3 rounded-[25%]"
                                style={{ backgroundColor: getColorForValue(val) }}
                                title={`Value: ${val}`}
                            />
                        );
                    })}
                    <span>More</span>
                </div>
            </div>

            {/* Heatmap Grid Area */}
            <div className="p-6 pt-4 overflow-x-auto flex justify-center items-center">
                <div className="flex gap-2 min-w-max">

                    {/* Y-Axis Labels (Weekdays) */}
                    <div className="flex flex-col justify-end gap-1.25 pt-6 pb-0.5 pr-2 text-[10px] font-bold text-muted-foreground leading-3">
                        {getDayLabels().map((label, i) => (
                            <span key={i} className="h-3">{label}</span>
                        ))}
                    </div>

                    {/* The Grid */}
                    <div className="flex flex-col">

                        {/* Month Headers Row */}
                        <div className="flex gap-1 mb-2 h-4">
                            {weeks.map((week, idx) => {
                                const label = getMonthLabel(idx, week);
                                return (
                                    <div key={idx} className="w-3 text-[10px] font-bold text-muted-foreground overflow-visible whitespace-nowrap">
                                        {label}
                                    </div>
                                )
                            })}
                        </div>

                        {/* Weeks Columns */}
                        <div className="flex gap-1">
                            {weeks.map((week, idx) => (
                                <div key={idx} className="flex flex-col gap-1">
                                    {week.map((date) => {
                                        const dStr = formatDate(date);
                                        const val = getRating(dStr);
                                        const isSelected = selectedDay === dStr;
                                        const isToday = dStr === todayStr;
                                        const isFuture = dStr > todayStr;

                                        // Hide future days to maintain grid structure but show nothing
                                        if (isFuture) {
                                            return <div key={dStr} className="w-3 h-3" />;
                                        }

                                        const backgroundColor = getColorForValue(val || 0);

                                        return (
                                            <div
                                                key={dStr}
                                                onClick={() => { setSelectedDay(dStr) }}
                                                style={{ backgroundColor }}
                                                className={`
                                                    w-3 h-3 rounded-[25%] cursor-pointer transition-all border border-transparent
                                                    ${isSelected ? 'border-border! z-10 scale-125 shadow-md ring-1 ring-primary' : ''}
                                                    ${isToday ? 'ring-1 ring-slate-900 dark:ring-white z-10' : ''}
                                                    hover:scale-125 hover:z-20 hover:shadow-sm
                                                `}
                                                title={`${dStr}: ${val} units`}
                                            />
                                        )
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}