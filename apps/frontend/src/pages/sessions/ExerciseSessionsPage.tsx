import { useMemo, useEffect } from 'react';
import {
    Dumbbell, Activity, Book as MenuBook, Code,
    Star, Droplet, Trophy, ChevronLeft, ChevronRight, CalendarSearch
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useExerciseSessions } from '@/hooks/use-exercise-sessions';
import { ExerciseSessionPanel } from '../tracker/StructuredHabitPanel';
import { mapValueToColor } from '@/lib/colorUtils';
import { ColorStop } from '@trackbit/types';
import { formatDate } from '../tracker/utils';
import { format, addDays, isAfter } from 'date-fns';
import { useSearchParams, useNavigate } from 'react-router-dom';

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

const ExerciseSessionsPage = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const {
        complexHabits,
        currentHabit,
        selectedDay,
        setHabitId,
        setDay,
        isLoading,
    } = useExerciseSessions();

    const today = formatDate(new Date());

    // Sync URL params → store on mount and whenever params change
    useEffect(() => {
        const paramHabitId = searchParams.get('habitId');
        const paramDate = searchParams.get('date');
        if (paramHabitId) setHabitId(Number(paramHabitId));
        if (paramDate) setDay(paramDate);
    }, [searchParams]);

    const setParams = (habitId?: number, date?: string) => {
        const next = new URLSearchParams(searchParams);
        if (habitId !== undefined) next.set('habitId', String(habitId));
        if (date !== undefined) next.set('date', date);
        setSearchParams(next, { replace: true });
    };

    const handleDateChange = (offset: number) => {
        const newDate = addDays(new Date(selectedDay + 'T00:00:00.000'), offset);
        if (isAfter(newDate, new Date())) return;
        setParams(undefined, format(newDate, 'yyyy-MM-dd'));
    };

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading sessions...</div>;
    }

    if (complexHabits.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center flex-col gap-4">
                <div className="p-6 bg-muted rounded-full">
                    <Dumbbell className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                    No workout habits found. Create a "Structured Session" habit in Settings.
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between gap-4">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Dumbbell className="w-8 h-8 text-primary" />
                        Exercise Sessions
                    </h1>
                    <div className="flex overflow-x-auto gap-2 pb-2">
                        {complexHabits.map((habit) => {
                            const IconComponent = getHabitIcon(habit.icon);
                            return (
                                <Button
                                    key={habit.id}
                                    onClick={() => setParams(habit.id, today)}
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

                {/* Day detail */}
                {selectedDay && currentHabit && (
                    <div className="bg-background rounded-xl shadow-lg border border-border overflow-hidden">
                        {/* Date navigator */}
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="flex border h-10 w-64 items-center justify-between gap-2 border-border rounded-md overflow-hidden shadow-sm">
                                    <button
                                        onClick={() => handleDateChange(-1)}
                                        className="h-full aspect-square flex items-center justify-center border-r hover:bg-muted transition-colors"
                                        aria-label="Previous day"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {format(selectedDay + 'T00:00:00.000', 'PPPP')}
                                    </p>
                                    <button
                                        onClick={() => handleDateChange(1)}
                                        disabled={selectedDay === today}
                                        className="h-full aspect-square flex items-center justify-center border-l hover:bg-muted transition-colors disabled:opacity-30"
                                        aria-label="Next day"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <Button
                                disabled={selectedDay === today}
                                onClick={() => setParams(undefined, today)}
                                variant="outline"
                            >
                                Today
                                <CalendarSearch className="w-5 h-5 ml-2" />
                            </Button>
                        </div>

                        {/* Session panel */}
                        <ExerciseSessionPanel />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExerciseSessionsPage;
