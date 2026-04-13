import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/shared/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";

interface DateSelectorProps {
    selectedDay: string;
    today: string;
    onDateChange: (offset: number) => void;
    onDateSelect: (date: string) => void;
}

export const DateSelector = ({ selectedDay, today, onDateChange, onDateSelect }: DateSelectorProps) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="flex border h-10 w-65 items-center justify-between gap-2 border-border rounded-md overflow-hidden shadow-sm">
            <button
                onClick={() => onDateChange(-1)}
                className="h-full aspect-square flex items-center justify-center border-r hover:bg-muted transition-colors"
                aria-label="Previous day"
            >
                <ChevronLeft className="w-4 h-4" />
            </button>

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button className="text-sm text-muted-foreground font-medium px-3 whitespace-nowrap hover:text-foreground transition-colors cursor-pointer">
                        {selectedDay === today ? "Today" : format(selectedDay + "T00:00:00.000", "PPP")}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                    <Calendar
                        mode="single"
                        selected={new Date(selectedDay + "T00:00:00.000")}
                        onSelect={(date) => {
                            if (date) {
                                onDateSelect(format(date, "yyyy-MM-dd"));
                                setOpen(false);
                            }
                        }}
                        disabled={{ after: new Date() }}
                        defaultMonth={new Date(selectedDay + "T00:00:00.000")}
                    />
                </PopoverContent>
            </Popover>

            <button
                onClick={() => onDateChange(1)}
                disabled={selectedDay === today}
                className="h-full aspect-square flex items-center justify-center border-l hover:bg-muted transition-colors disabled:opacity-30"
                aria-label="Next day"
            >
                <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
};
