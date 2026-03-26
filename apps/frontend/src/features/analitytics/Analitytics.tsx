import { useState } from "react";
import { BarChart3, Eye, EyeOff, SlidersHorizontal } from "lucide-react";
import { Stats } from "./Stats";
import { Heatmap } from "@/shared/components/Heatmap";
import { useAnalytics } from "./use-analytics";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { DateTime } from "luxon";

export const Analytics = () => {
    const {
        sortedHabits, currentHabit, isLoading,
        selectedDay, setDay, setHabitId,
        getRating, stats,
    } = useAnalytics();
    const [showHeatmap, setShowHeatmap] = useState(true);
    const [showFilters, setShowFilters] = useState(false);

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
                                onValueChange={(val) => { setHabitId(Number(val)); setDay(DateTime.now().toISODate()); }}
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

                <Stats stats={stats} />

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