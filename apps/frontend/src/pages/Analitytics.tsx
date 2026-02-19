import { useMemo, useState } from "react";
import { BarChart3, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { Stats } from "./tracker/Stats";
import { Heatmap } from "@/components/Heatmap";
import { useTracker } from "@/hooks/use-tracker";
import { formatDate } from "./tracker/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Analytics = () => {
    const { habitsWithLogs, isLoading, currentHabit, selectedDay, setDay, setHabitId } = useTracker();
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showFilters, setShowFilters] = useState(false);

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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <BarChart3 className="w-8 h-8 text-blue-500" />
                        Stats
                    </h1>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="habit-select" className="text-sm text-muted-foreground whitespace-nowrap">Habit</Label>
                            <Select
                                value={currentHabit ? String(currentHabit.id) : ""}
                                onValueChange={(val) => { setHabitId(Number(val)); setDay(formatDate(new Date())); }}
                            >
                                <SelectTrigger id="habit-select" className="w-48">
                                    <SelectValue placeholder="Select a habit…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sortedHabits.map((habit) => (
                                        <SelectItem key={habit.id} value={String(habit.id)}>
                                            {habit.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setShowHeatmap(v => !v)}
                            aria-label={showHeatmap ? 'Hide heatmap' : 'Show heatmap'}
                        >
                            {showHeatmap ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                        </Button>
                        <Button
                            variant={showFilters ? 'secondary' : 'outline'}
                            size="icon"
                            onClick={() => setShowFilters(v => !v)}
                            aria-label="Toggle filters"
                        >
                            <SlidersHorizontal className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <Stats />

                {currentHabit && showHeatmap && (
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