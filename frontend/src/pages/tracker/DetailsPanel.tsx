import { useExercises } from "@/hooks/use-exercises";
import { CalendarSearch, ChevronDown, Dumbbell, Hash, Minus, Plus, Save, Scale, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { SetInputField } from "./SetInputField";
import { Button } from "@/components/ui/button";
import { SimpleHabitPanel } from "./SimpleHabitPanel";
import { ExerciseSessionPanel } from "./ep";


interface WorkoutSet {
    exerciseId: number;
    setNumber: number;
    reps: number;
    weight: number;
    weightUnit: string;
}

interface DetailsPanelProps {
    selectedDay: string | null;
    setSelectedDay: (day: string | null) => void;
    activeHabit: Trackbit.Habit;
    logsMap: Record<string, number>;
    logSimple: any;
    logWorkout: (data: { habitId: string; date: string; sets: any[] }) => void;
    logs: any[];
}

export function DayLog({ selectedDay, setSelectedDay, activeHabit, logsMap, logSimple, logWorkout, logs }: DetailsPanelProps) {
    return (

        (selectedDay && activeHabit) ?
            <div className="bg-background rounded-xl shadow-lg border border-border overflow-hidden">
                {/* Header Section */}
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">
                            {new Date(selectedDay).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h2>
                    </div>
                    <Button
                        onClick={() => setSelectedDay(new Date().toLocaleDateString())}
                        variant="outline">
                        Today
                        <CalendarSearch className="w-5 h-5" />
                    </Button>
                </div>



                {
                    activeHabit.type === 'complex' ? (
                        <ExerciseSessionPanel
                            dateStr={selectedDay}
                            habitId={activeHabit.id}
                            logs={logs}
                            onSaveLog={logWorkout}
                            onClose={() => setSelectedDay(null)}
                        />
                    ) : (
                        <SimpleHabitPanel
                            dateStr={selectedDay}
                            value={logsMap[selectedDay] || 0}
                            color={activeHabit.colorStops}
                            onClose={() => setSelectedDay(null)}
                            updateCount={(val: number) => logSimple({ habitId: activeHabit.id, date: selectedDay, value: val })}
                            activeHabit={activeHabit}
                        />
                    )
                }
            </div >
            : null
    );
}
