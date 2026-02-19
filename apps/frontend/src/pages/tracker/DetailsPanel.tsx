import { CalendarSearch, NotebookPen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimpleHabitPanel } from "./SimpleHabitPanel";
import { useTracker } from "@/hooks/use-tracker";
import { formatDate } from "./utils";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

export function DayLog() {

    const { selectedDay, setDay, currentHabit } = useTracker()
    const navigate = useNavigate()

    return (

        (selectedDay && currentHabit) ?
            <div className="bg-background rounded-xl shadow-lg border border-border overflow-hidden">
                {/* Header Section */}
                <div className="p-6 border-b border-border flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">
                            {format(selectedDay + 'T00:00:00.000', "PPPP")}
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
                        <div className="p-8 text-center space-y-4">
                            <p className="text-muted-foreground">
                                Exercise session logging has moved to its own dedicated page.
                            </p>
                            <Button onClick={() => navigate('/sessions')} className="gap-2">
                                <ExternalLink className="w-4 h-4" />
                                Go to Exercise Sessions
                            </Button>
                        </div>
                        :
                        <SimpleHabitPanel />

                }
            </div >
            : null
    );
}
