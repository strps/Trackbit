import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Activity, Dumbbell, Book as MenuBook, Code,
    Star, Droplet, Trophy, Flame, Minus, Plus, ArrowRight,
    ChevronLeft, ChevronRight, CalendarSearch
} from 'lucide-react';
import { useTracker } from '@/hooks/use-tracker';
import { mapValueToColor, mapValueToColorOrdered } from '@/lib/colorUtils';
import { ColorStop } from '@trackbit/types';
import { formatDate } from './utils';
import { Button } from '@/components/ui/button';
import { format, addDays, isAfter } from 'date-fns';

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

const TrackerHome = () => {
    const { habitsWithLogs, isLoading, logSimple, setHabitId, setDay } = useTracker();
    const navigate = useNavigate();
    const today = formatDate(new Date());
    const [selectedDay, setSelectedDay] = useState(today);

    const handleDateChange = (offset: number) => {
        const newDate = addDays(new Date(selectedDay + 'T00:00:00.000'), offset);
        if (isAfter(newDate, new Date())) return;
        setSelectedDay(format(newDate, 'yyyy-MM-dd'));
    };

    const sortedHabits = useMemo(() => {
        return Object.values(habitsWithLogs).sort((a, b) => {
            const orderDiff = (a.order ?? 0) - (b.order ?? 0);
            return orderDiff !== 0 ? orderDiff : a.id - b.id;
        });
    }, [habitsWithLogs]);

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading habits...</div>;
    }

    if (sortedHabits.length === 0) {
        return (
            <div className="flex h-screen items-center justify-center flex-col gap-4">
                <div className="p-6 bg-muted rounded-full">
                    <Dumbbell className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No habits found. Go to Settings to create one!</p>
            </div>
        );
    }

    const goToSessions = (habitId: number) => {
        setHabitId(habitId);
        setDay(selectedDay);
        navigate('/sessions');
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Flame className="w-8 h-8 text-orange-500 fill-orange-500" />
                        Tracker
                    </h1>
                    <div className="flex items-center gap-3">
                        <div className="flex border h-10 items-center justify-between gap-2 border-border rounded-md overflow-hidden shadow-sm">
                            <button
                                onClick={() => handleDateChange(-1)}
                                className="h-full aspect-square flex items-center justify-center border-r hover:bg-muted transition-colors"
                                aria-label="Previous day"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <p className="text-sm text-muted-foreground font-medium px-3 whitespace-nowrap">
                                {selectedDay === today ? 'Today' : format(selectedDay + 'T00:00:00.000', 'PPP')}
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
                        {selectedDay !== today && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedDay(today)}
                                className="gap-1"
                            >
                                Today
                                <CalendarSearch className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    {sortedHabits.map((habit) => {
                        const IconComponent = getHabitIcon(habit.icon);
                        const accentColor = getColorAtOne(habit.colorStops);

                        if (habit.type === 'complex') {
                            // Complex habit → link to sessions
                            const sessionsCount = habit.dayLogs?.[selectedDay]?.exerciseSessions?.length || 0;
                            return (
                                <div
                                    key={habit.id}
                                    className="relative bg-card text-card-foreground border rounded-xl p-5 shadow-sm overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: accentColor }} />
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="p-2.5 rounded-lg shrink-0" style={{ backgroundColor: accentColor, opacity: 0.9 }}>
                                                <IconComponent className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-semibold truncate">{habit.name}</h3>
                                                <p className="text-sm text-muted-foreground">
                                                    {sessionsCount > 0
                                                        ? `${sessionsCount} session${sessionsCount !== 1 ? 's' : ''}`
                                                        : 'No sessions'}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={() => goToSessions(habit.id)}
                                            className="gap-2 shrink-0"
                                        >
                                            {sessionsCount > 0 ? 'Continue' : 'Start'}
                                            <ArrowRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        }

                        // Simple / negative habit → inline counter
                        return (
                            <SimpleHabitRow
                                key={habit.id}
                                habitId={habit.id}
                                name={habit.name}
                                icon={<IconComponent className="w-5 h-5 text-white" />}
                                accentColor={accentColor}
                                colorStops={habit.colorStops}
                                dailyGoal={habit.dailyGoal}
                                value={habit.dayLogs?.[selectedDay]?.rating || 0}
                                onLog={(rating) => logSimple({ rating, habitId: habit.id, day: selectedDay })}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TrackerHome;

// -------------------------------------------------------------------
// Inline simple-habit counter row
// -------------------------------------------------------------------
interface SimpleHabitRowProps {
    habitId: number;
    name: string;
    icon: React.ReactNode;
    accentColor: string;
    colorStops: ColorStop[];
    dailyGoal: number;
    value: number;
    onLog: (rating: number) => void;
}

const SimpleHabitRow = ({
    name,
    icon,
    accentColor,
    colorStops,
    dailyGoal,
    value,
    onLog,
}: SimpleHabitRowProps) => {
    const [isAnimating, setIsAnimating] = useState(false);

    const goal = dailyGoal || 1;
    const progress = Math.min(value / goal, 1);
    const isGoalMet = value >= goal;

    // Progress ring
    const radius = 22;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - progress * circumference;

    const rgb = mapValueToColorOrdered(progress, 0, 1, colorStops);
    const colorString = `rgb(${rgb.join(',')})`;

    useEffect(() => {
        setIsAnimating(true);
        const t = setTimeout(() => setIsAnimating(false), 200);
        return () => clearTimeout(t);
    }, [value]);

    return (
        <div className="relative bg-card text-card-foreground border rounded-xl p-5 shadow-sm overflow-hidden">
            <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: accentColor }} />
            <div className="flex items-center justify-between gap-4">
                {/* Left: icon + name + progress text */}
                <div className="flex items-center gap-4 min-w-0">
                    <div className="p-2.5 rounded-lg shrink-0" style={{ backgroundColor: accentColor, opacity: 0.9 }}>
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-semibold truncate flex items-center gap-2">
                            {name}
                            {isGoalMet && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                                    <Trophy className="w-3 h-3 mr-0.5" /> Done
                                </span>
                            )}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {value} / {goal} completed
                        </p>
                    </div>
                </div>

                {/* Right: compact counter */}
                <div className="flex items-center gap-2 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onLog(value - 1)}
                        disabled={value <= 0}
                        className="h-9 w-9 rounded-full border border-input text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                        <Minus className="w-4 h-4" />
                    </Button>

                    {/* Mini progress ring */}
                    <div className="relative w-14 h-14 flex items-center justify-center">
                        <svg className="absolute w-full h-full transform -rotate-90">
                            <circle cx="50%" cy="50%" r={radius} stroke="currentColor" strokeWidth="5" fill="transparent" className="text-muted" />
                            <circle
                                cx="50%" cy="50%" r={radius}
                                stroke={colorString} strokeWidth="5" fill="transparent" strokeLinecap="round"
                                style={{
                                    strokeDasharray: circumference,
                                    strokeDashoffset,
                                    transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.5s ease'
                                }}
                            />
                        </svg>
                        <span
                            className={`relative z-10 text-lg font-black transition-transform ${isAnimating ? 'scale-125' : 'scale-100'}`}
                            style={{ color: colorString }}
                        >
                            {value}
                        </span>
                    </div>

                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => onLog(value + 1)}
                        className="h-10 w-10 rounded-full shadow-sm border-2 transition-all active:scale-95"
                        style={{
                            borderColor: !isGoalMet ? colorString : undefined,
                            color: !isGoalMet ? colorString : undefined
                        }}
                    >
                        <Plus className={`w-5 h-5 ${isGoalMet ? 'text-yellow-500' : ''}`} />
                    </Button>
                </div>
            </div>
        </div>
    );
};
