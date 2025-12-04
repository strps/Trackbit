import { Activity } from "lucide-react";
import { formatDate } from "./utils";
import { mapValueToColor, rgbToHex } from "@/lib/colorUtils";

interface HeatmapProps {
    weeks: Date[][];
    selectedDay: string;
    setSelectedDay: (day: string) => void;
    activeHabit: Trackbit.Habit;
    logsMap: Record<string, number>;
    todayStr: string;
}

export const Heatmap = ({ weeks, selectedDay, setSelectedDay, activeHabit, logsMap, todayStr }: HeatmapProps) => {


    // console.log(activeHabit)
    console.log(logsMap)
    // 1. Prepare the Palette
    // We default to a Green scale if the habit doesn't have a palette defined yet
    const defaultColorStops: Trackbit.ColorStop[] = [
        { position: 0, color: [241, 245, 249] }, // Slate-100 (Empty)
        { position: 0.2, color: [187, 247, 208] }, // Green-200
        { position: 0.6, color: [34, 197, 94] },   // Green-500
        { position: 1.0, color: [21, 128, 61] }    // Green-700
    ];

    const colorStops: Trackbit.ColorStop[] = activeHabit?.colorStops || defaultColorStops;

    // 2. Define Targets
    // For the color scale: 0 is min, dailyGoal is max (100% intensity)
    const dailyTarget = activeHabit?.dailyGoal || 1; // Default to 1 for simple checkboxes

    const getColorForValue = (val: number) => {
        const [r, g, b] = mapValueToColor(val, 0, dailyTarget, colorStops);
        return `rgb(${r}, ${g}, ${b})`;
    };


    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6">
                <div className='flex justify-between items-center mb-6'>

                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Activity className="w-5 h-5 text-slate-400" />
                            Activity Log
                        </h2>
                    </div>

                    {/* Gradient Legend */}
                    <div className="text-xs text-slate-400 mt-2 flex justify-end gap-2 items-center">
                        <span>Less</span>
                        {/* Render 5 steps of intensity based on the daily target */}
                        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                            const val = Math.ceil(dailyTarget * ratio);
                            const color = getColorForValue(val);
                            return (
                                <div
                                    key={ratio}
                                    className="w-3 h-3 rounded-sm"
                                    style={{ backgroundColor: color }}
                                    title={`Value: ${val}`}
                                />
                            );
                        })}
                        <span>More</span>
                    </div>

                </div>
                <div className="flex overflow-x-auto pb-4">
                    <div className="flex gap-1 min-w-max">
                        {weeks.map((week, idx: number) => (
                            <div key={idx} className="flex flex-col gap-1">
                                {week.map((date: Date) => {
                                    const dStr = formatDate(date);
                                    const val = logsMap[dStr] || 0;
                                    const isSelected = selectedDay === dStr;
                                    const isToday = dStr === todayStr;

                                    // Calculate dynamic color
                                    const backgroundColor = getColorForValue(val);

                                    return (
                                        <div
                                            key={dStr}
                                            onClick={() => setSelectedDay(dStr)}
                                            // Apply inline style for the calculated color
                                            style={{ backgroundColor }}
                                            className={`
                                                w-3 h-3 rounded-sm cursor-pointer transition-all border border-transparent
                                                ${isSelected ? 'border-blue-500! z-10 scale-125 shadow-sm' : ''}
                                                ${isToday ? 'ring-1 ring-slate-900 dark:ring-white z-10' : ''}
                                                hover:scale-125 hover:z-20 hover:shadow-sm
                                            `}
                                            title={`${dStr}: ${val} ${activeHabit?.type === 'complex' ? 'sessions' : 'units'}`}
                                        />
                                    )
                                })}
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    )
}