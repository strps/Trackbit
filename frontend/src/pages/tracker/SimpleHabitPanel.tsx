import { useEffect, useState } from "react";
import { Minus, Plus, CalendarSearch, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { mapValueToColorOrdered } from "@/lib/colorUtils"; // Adjust path as needed
import { useHabitLogs } from "@/hooks/use-habit-logs";
import { useTrackerStore } from "./store";

export const SimpleHabitPanel = () => {

    const [isAnimating, setIsAnimating] = useState(false);

    const { habitsWithLogs, logSimple } = useHabitLogs()
    const selectedHabitId = useTrackerStore((state) => state.selectedHabitId);

    const dateStr = useTrackerStore((state) => state.selectedDay);
    const activeHabit = habitsWithLogs[selectedHabitId]

    const value = activeHabit.dayLogs[dateStr]?.rating || 0;

    // 1. Calculate Progress
    const goal = activeHabit.dailyGoal || 1;
    const progress = Math.min(value / goal, 1);
    const radius = 36;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - progress * circumference;
    const isGoalMet = value >= goal;

    // 2. Get Dynamic Color from Gradient
    // We use the util to pick the color corresponding to current progress (0 to 1)
    const colorStops = activeHabit.colorStops || [
        { position: 0, color: [226, 232, 240] },
        { position: 1, color: [16, 185, 129] }
    ];
    const rgb = mapValueToColorOrdered(progress, 0, 1, colorStops);
    const colorString = `rgb(${rgb.join(",")})`;

    // Trigger animation on value change
    //TODO: this might be deleted or changed, as values is calculated on each render
    useEffect(() => {
        setIsAnimating(true);
        const timer = setTimeout(() => setIsAnimating(false), 200);
        return () => clearTimeout(timer);
    }, [value]);

    const handleIncrement = () => {
        logSimple({ habitId: Number(selectedHabitId), date: dateStr, rating: Number(value + 1) })
    };

    const handleDecrement = () => {
        logSimple({ habitId: Number(selectedHabitId), date: dateStr, rating: Number(value - 1) })
    };



    return (
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-b-xl animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between gap-6">

                {/* Left: Context Info */}
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long' })}
                        {isGoalMet && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 animate-in zoom-in">
                                <Trophy className="w-3 h-3 mr-1" /> Goal Met
                            </span>
                        )}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {value} / {goal} {activeHabit.type === 'complex' ? 'sessions' : 'units'} completed
                    </p>
                </div>

                {/* Center: The Progress Ring Controls */}
                <div className="flex items-center gap-4">

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleDecrement}
                        disabled={value <= 0}
                        className="h-12 w-12 rounded-full border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10"
                    >
                        <Minus className="w-6 h-6" />
                    </Button>

                    <div className="relative w-24 h-24 flex items-center justify-center">
                        {/* Background Ring */}
                        <svg className="absolute w-full h-full transform -rotate-90">
                            <circle
                                cx="50%"
                                cy="50%"
                                r={radius}
                                stroke="currentColor"
                                strokeWidth="8"
                                fill="transparent"
                                className="text-slate-100 dark:text-slate-800"
                            />
                            {/* Progress Ring */}
                            <circle
                                cx="50%"
                                cy="50%"
                                r={radius}
                                stroke={colorString}
                                strokeWidth="8"
                                fill="transparent"
                                strokeLinecap="round"
                                style={{
                                    strokeDasharray: circumference,
                                    strokeDashoffset,
                                    transition: "stroke-dashoffset 0.5s ease-out, stroke 0.5s ease"
                                }}
                            />
                        </svg>

                        {/* Value Display */}
                        <div className="relative z-10 text-center">
                            <span
                                className={`block text-3xl font-black transition-transform ${isAnimating ? "scale-125" : "scale-100"}`}
                                style={{ color: colorString }}
                            >
                                {value}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-400">Count</span>
                        </div>
                    </div>

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={handleIncrement}
                        className={`
                            h-14 w-14 rounded-full shadow-md border-2 transition-all active:scale-95
                            ${isGoalMet ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}
                        `}
                        style={{
                            borderColor: !isGoalMet ? colorString : undefined,
                            color: !isGoalMet ? colorString : undefined
                        }}
                    >
                        <Plus className={`w-8 h-8 ${isGoalMet ? 'text-yellow-500' : ''}`} />
                    </Button>
                </div>



            </div>
        </div>
    );
};