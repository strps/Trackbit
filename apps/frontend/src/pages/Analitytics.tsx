import { useMemo } from "react";
import {
    BarChart3, Activity, Dumbbell, Book as MenuBook,
    Code, Star, Droplet, Trophy
} from "lucide-react";
import { Stats } from "./tracker/Stats";
import { Heatmap } from "@/components/Heatmap";
import { useTracker } from "@/hooks/use-tracker";
import { mapValueToColor } from "@/lib/colorUtils";
import { ColorStop } from "@trackbit/types";
import { Button } from "@/components/ui/button";
import { formatDate } from "./tracker/utils";

const getHabitIcon = (iconName: string): React.ElementType => {
    switch (iconName) {
        case 'dumbbell': return Dumbbell;
        case 'code': return Code;
        case 'book': return MenuBook;
        case 'star': return Star;
        case 'water': return Droplet;
        case 'alert': return Trophy;
        default: return Activity;
    }
};

const getColorAtOne = (colorStops: ColorStop[]) => {
    const [r, g, b] = mapValueToColor(1, 0, 1, colorStops);
    return `rgb(${r}, ${g}, ${b})`;
};

export const Analytics = () => {
    const { habitsWithLogs, isLoading, currentHabit, selectedDay, setDay, setHabitId } = useTracker();

    const sortedHabits = useMemo(() => {
        return Object.values(habitsWithLogs).sort((a, b) => {
            const orderDiff = (a.order ?? 0) - (b.order ?? 0);
            return orderDiff !== 0 ? orderDiff : a.id - b.id;
        });
    }, [habitsWithLogs]);

    const logsMap = currentHabit?.dayLogs;

    const getRating = (date: string): number => {
        if (!logsMap) return 0;
        return currentHabit?.type === 'complex'
            ? logsMap[date]?.exerciseSessions?.reduce(
                (a, c) => a + (c.exerciseLogs?.length || 0), 0) || 0
            : logsMap[date]?.rating || 0;
    };

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading analytics...</div>;
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <BarChart3 className="w-8 h-8 text-blue-500" />
                        Analytics
                    </h1>
                    <div className="flex overflow-x-auto gap-2 pb-2">
                        {sortedHabits.map((habit) => {
                            const IconComponent = getHabitIcon(habit.icon);
                            return (
                                <Button
                                    key={habit.id}
                                    onClick={() => { setHabitId(habit.id); setDay(formatDate(new Date())); }}
                                    style={{ backgroundColor: getColorAtOne(habit.colorStops) }}
                                    className={`gap-2 cursor-pointer ${currentHabit?.id === habit.id && 'ring-1 ring-primary'}`}
                                >
                                    <IconComponent className="w-4 h-4" />
                                    {habit.name}
                                </Button>
                            );
                        })}
                    </div>
                </div>

                <Stats />

                {currentHabit && (
                    <Heatmap
                        getRating={getRating}
                        maxValue={currentHabit.dailyGoal}
                        selectedDate={selectedDay}
                        onDateSelect={setDay}
                        colorStops={currentHabit.colorStops}
                    />
                )}
            </div>
        </div>
    );
};