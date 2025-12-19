import { CalendarSearch, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleHabitPanel } from "./SimpleHabitPanel";
import { ExerciseSessionPanel } from "./StructuredHabitPanel";
import { useHabitLogs } from "@/hooks/use-habit-logs";
import { formatDate } from "./utils";

export function DayLog() {

    const { selectedDay, setDay, currentHabit } = useHabitLogs()

    return (

        (selectedDay && currentHabit) ?
            <div className="bg-background rounded-xl shadow-lg border border-border overflow-hidden">
                {/* Header Section */}
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">
                            {new Date(selectedDay).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </h2>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                        >
                            <NotebookPen className="w-5 h-5" />
                        </Button>
                        <Button
                            disabled={selectedDay === formatDate(new Date())}
                            onClick={() => {
                                setDay(formatDate(new Date()))
                            }}
                            variant="outline">
                            Today
                            <CalendarSearch className="w-5 h-5" />
                        </Button>
                    </div>
                </div>



                {
                    currentHabit.type === 'complex' ?
                        <ExerciseSessionPanel />
                        :
                        <SimpleHabitPanel />

                }
            </div >
            : null
    );
}
