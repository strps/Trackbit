import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
    Activity, Dumbbell, Book as MenuBook, Code,
    Star, Droplet, Trophy, Flame, Minus, Plus, ArrowRight,
    ChevronLeft, ChevronRight, CalendarSearch, Check, ShieldAlert
} from 'lucide-react';
import { useTracker } from './use-tracker';
import { mapValueToColor, mapValueToColorOrdered } from '@/shared/utils/colorUtils';
import { ColorStop } from '@trackbit/types';
import { computeStreak } from './utils';
import { Button } from '@/shared/components/ui/button';
import { Timer } from '@/shared/components/Timer';
import { format, addDays, subDays, isAfter } from 'date-fns';
import { cn } from '@/shared/utils/utils';
import { DateTime } from 'luxon';

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

// -------------------------------------------------------------------
// Tiered progress badge: Bronze → Silver → Gold
// -------------------------------------------------------------------
const ProgressBadge = ({ progress, isAntiHabit }: { progress: number; isAntiHabit?: boolean }) => {
    // Anti-habit: show "Avoided" when no progress (success state)
    if (isAntiHabit) {
        if (progress <= 0) {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    <ShieldAlert className="w-3 h-3 mr-0.5" /> Avoided
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                <ShieldAlert className="w-3 h-3 mr-0.5" /> Slipped
            </span>
        );
    }

    if (progress <= 0) return null;

    if (progress >= 1) {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                <Trophy className="w-3 h-3 mr-0.5" /> Done
            </span>
        );
    }

    if (progress >= 0.5) {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-200 text-slate-600 dark:bg-slate-600/30 dark:text-slate-300">
                <Trophy className="w-3 h-3 mr-0.5" /> Halfway
            </span>
        );
    }

    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-500">
            <Trophy className="w-3 h-3 mr-0.5" /> Started
        </span>
    );
};

const StreakBadge = ({ streak }: { streak: number }) => {
    if (streak < 2) return null;
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
            <Flame className="w-3 h-3 mr-0.5" /> {streak} day streak
        </span>
    );
};

const TrackerHome = () => {
    const { habitsWithLogs, isLoading, logSimple } = useTracker();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const today = DateTime.now().toISODate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [selectedDay, setSelectedDay] = useState(searchParams.get('date') ?? today);
    const [timeZone, setTimeZone] = useState(searchParams.get('time_zone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
    console.log('Current time zone:', timeZone);
    useEffect(() => {
        setSearchParams({ date: selectedDay, timezone: timeZone });
    }, [selectedDay]);
    useEffect(() => {
        setSearchParams({ date: selectedDay, timezone: timeZone });
    }, [timeZone]);

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

    const regularHabits = useMemo(() => sortedHabits.filter(h => !h.isAntiHabit), [sortedHabits]);
    const antiHabits = useMemo(() => sortedHabits.filter(h => h.isAntiHabit), [sortedHabits]);

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

    const goToSessions = async (habitId: number) => {
        const dayLog = habitsWithLogs[habitId]?.dayLogs?.[selectedDay];
        if (dayLog?.id) {
            navigate(`/sessions?logId=${dayLog.id}`);
            return;
        }
        // No dayLog for this date — create one, then navigate with its logId
        try {
            const timeStamp = new Date().toISOString();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/tracker/day-logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ habitId, timeStamp }),
            });
            if (!res.ok) throw new Error('Failed to create day log');
            const newDayLog = await res.json();
            // Insert the new dayLog into the cache so the sessions page can find it
            queryClient.setQueryData(['habit-logs'], (old: Record<number, any> | undefined) => {
                if (!old) return old;
                const updated = structuredClone(old);
                const habit = updated[habitId];
                if (habit) {
                    habit.dayLogs[selectedDay] = {
                        id: newDayLog.id,
                        habitId,
                        date: selectedDay,
                        localDay: selectedDay,
                        timeStamp: newDayLog.timeStamp ?? timeStamp,
                        createdAt: newDayLog.createdAt,
                        rating: newDayLog.rating ?? undefined,
                        notes: newDayLog.notes ?? undefined,
                        exerciseSessions: [],
                    };
                }
                return updated;
            });
            navigate(`/sessions?logId=${newDayLog.id}`);
        } catch (err) {
            console.error('Failed to create day log:', err);
        }
    };

    const renderHabitRow = (habit: typeof sortedHabits[number]) => {
        const IconComponent = getHabitIcon(habit.icon);
        const accentColor = getColorAtOne(habit.colorStops);
        const streak = computeStreak(habit.dayLogs ?? {}, selectedDay, habit.type, habit.isAntiHabit);

        if (habit.type === 'complex') {
            const sessions = habit.dayLogs?.[selectedDay]?.exerciseSessions ?? [];
            const sessionsCount = sessions.length;
            return (
                <ComplexHabitRow
                    key={habit.id}
                    name={habit.name}
                    icon={<IconComponent className="w-5 h-5 text-white" />}
                    accentColor={accentColor}
                    sessionsCount={sessionsCount}
                    sessions={sessions}
                    streak={streak}
                    onNavigate={() => goToSessions(habit.id)}
                />
            );
        }

        if (habit.type === 'timed') {
            return (
                <TimedHabitRow
                    key={habit.id}
                    name={habit.name}
                    icon={<IconComponent className="w-5 h-5 text-white" />}
                    accentColor={accentColor}
                    dailyGoal={habit.dailyGoal}
                    value={habit.dayLogs?.[selectedDay]?.rating || 0}
                    streak={streak}
                    isAntiHabit={habit.isAntiHabit}
                    onLog={(ms) => logSimple({ rating: ms, habitId: habit.id, day: selectedDay })}
                />
            );
        }

        if (habit.type === 'check') {
            const checked = (habit.dayLogs?.[selectedDay]?.rating || 0) >= 1;
            return (
                <CheckHabitRow
                    key={habit.id}
                    name={habit.name}
                    icon={<IconComponent className="w-5 h-5 text-white" />}
                    accentColor={accentColor}
                    checked={checked}
                    streak={streak}
                    isAntiHabit={habit.isAntiHabit}
                    onToggle={() => logSimple({ rating: checked ? 0 : 1, habitId: habit.id, day: selectedDay })}
                />
            );
        }

        // Count habit → inline counter
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
                streak={streak}
                isAntiHabit={habit.isAntiHabit}
                onLog={(rating) => logSimple({ rating, habitId: habit.id, day: selectedDay })}
            />
        );
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

                {/* Habits */}
                <div className="grid grid-cols-1 gap-3">
                    {regularHabits.map((habit) => renderHabitRow(habit))}
                </div>

                {/* Anti-Habits */}
                {antiHabits.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-lg font-semibold text-destructive flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5" />
                            Anti-Habits
                        </h2>
                        <div className="grid grid-cols-1 gap-3">
                            {antiHabits.map((habit) => renderHabitRow(habit))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrackerHome;

// -------------------------------------------------------------------
// Base habit row card shell
// -------------------------------------------------------------------
interface HabitRowProps {
    accentColor: string;
    icon: React.ReactNode;
    name: string;
    badges?: React.ReactNode;
    subtitle: React.ReactNode;
    right: React.ReactNode;
    className?: string;
    inactive?: boolean;
}

const HabitRow = ({ accentColor, icon, name, badges, subtitle, right, className, inactive }: HabitRowProps) => (
    <div className={cn(
        `relative bg-card text-card-foreground border rounded-xl shadow-sm overflow-hidden transition-all`,
        inactive ? 'p-3 h-24 grayscale opacity-60' : 'p-5 h-32',
        className
    )}>
        <div className="absolute top-0 left-0 bottom-0 w-1 rounded-l-xl" style={{ backgroundColor: accentColor }} />
        <div className="flex items-center justify-between gap-4 h-full">
            <div className="flex items-center gap-4 min-w-0">
                <div className={cn("rounded-lg shrink-0 transition-all", inactive ? "p-2" : "p-2.5")} style={{ backgroundColor: accentColor, opacity: 0.9 }}>
                    {icon}
                </div>
                <div className="min-w-0">
                    <h3 className={cn("font-semibold truncate", inactive && "text-sm")}>{name}</h3>
                    <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
                </div>
                {badges && <div className="flex flex-col gap-1">{badges}</div>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
                {right}
            </div>
        </div>
    </div>
);

// -------------------------------------------------------------------
// Complex habit row
// -------------------------------------------------------------------
interface ComplexHabitRowProps {
    name: string;
    icon: React.ReactNode;
    accentColor: string;
    sessionsCount: number;
    sessions: { exerciseLogs?: unknown[] }[];
    streak: number;
    onNavigate: () => void;
}

const ComplexHabitRow = ({ name, icon, accentColor, sessionsCount, sessions, streak, onNavigate }: ComplexHabitRowProps) => {
    const hasExercises = sessions.some(s => (s.exerciseLogs?.length ?? 0) > 0);
    const inactive = sessionsCount === 0 || !hasExercises;
    return (
        <HabitRow
            accentColor={accentColor}
            icon={icon}
            name={name}
            badges={
                <>
                    {hasExercises && <ProgressBadge progress={1} />}
                    <StreakBadge streak={streak} />
                </>
            }
            subtitle={sessionsCount > 0 ? `${sessionsCount} session${sessionsCount !== 1 ? 's' : ''}` : 'No sessions'}
            right={
                <Button variant="outline" onClick={onNavigate} className="gap-2 shrink-0">
                    {sessionsCount > 0 ? 'Continue' : 'Start'}
                    <ArrowRight className="w-4 h-4" />
                </Button>
            }
            inactive={inactive}
        />
    );
};

// -------------------------------------------------------------------
// Check habit row
// -------------------------------------------------------------------
interface CheckHabitRowProps {
    name: string;
    icon: React.ReactNode;
    accentColor: string;
    checked: boolean;
    streak: number;
    isAntiHabit?: boolean;
    onToggle: () => void;
}

const CheckHabitRow = ({
    name,
    icon,
    accentColor,
    checked,
    streak,
    isAntiHabit,
    onToggle,
}: CheckHabitRowProps) => {
    // Anti-habit: inactive (grayed) when NOT checked (success = avoided)
    const inactive = isAntiHabit ? !checked : !checked;
    const subtitle = isAntiHabit
        ? (checked ? 'Slipped' : 'Avoided')
        : (checked ? 'Completed' : 'Not yet');

    return (
        <HabitRow
            accentColor={accentColor}
            icon={icon}
            inactive={inactive}
            name={name}
            badges={
                <>
                    <ProgressBadge progress={checked ? 1 : 0} isAntiHabit={isAntiHabit} />
                    <StreakBadge streak={streak} />
                </>
            }
            subtitle={subtitle}
            right={
                <button
                    onClick={onToggle}
                    className={cn(
                        'relative w-14 h-14 rounded-full border-[3px] transition-all duration-300 ease-out flex items-center justify-center shrink-0',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                        'active:scale-90',
                        checked
                            ? 'border-transparent shadow-lg scale-100'
                            : 'border-muted-foreground/30 bg-transparent hover:border-muted-foreground/50 scale-100'
                    )}
                    style={checked ? { backgroundColor: accentColor } : undefined}
                    aria-label={checked ? 'Mark as incomplete' : 'Mark as complete'}
                >
                    <Check
                        className={cn(
                            'transition-all duration-300 ease-out',
                            checked
                                ? 'w-7 h-7 text-white opacity-100 scale-100'
                                : 'w-6 h-6 text-muted-foreground/40 opacity-100 scale-90'
                        )}
                        strokeWidth={checked ? 3.5 : 2}
                    />
                </button>
            }
        />
    );
};

// -------------------------------------------------------------------
// Timed habit row
// -------------------------------------------------------------------
interface TimedHabitRowProps {
    name: string;
    icon: React.ReactNode;
    accentColor: string;
    dailyGoal: number;
    value: number; // stored as milliseconds
    streak: number;
    isAntiHabit?: boolean;
    onLog: (ms: number) => void;
}

const formatMs = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}m ${secs}s`;
};

const TimedHabitRow = ({
    name,
    icon,
    accentColor,
    dailyGoal,
    value,
    streak,
    isAntiHabit,
    onLog,
}: TimedHabitRowProps) => {
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    // dailyGoal is in minutes for timed habits, value is in ms
    const goalMs = (dailyGoal || 1) * 60000;
    const timedProgress = Math.min(value / goalMs, 1);
    // Active as soon as the timer is running OR there's already logged time
    const inactive = isAntiHabit ? (value === 0 && !isTimerRunning) : (value === 0 && !isTimerRunning);

    return (
        <HabitRow
            accentColor={accentColor}
            icon={icon}
            inactive={inactive}
            name={name}
            badges={
                <>
                    <ProgressBadge progress={timedProgress} isAntiHabit={isAntiHabit} />
                    <StreakBadge streak={streak} />
                </>
            }
            subtitle={isAntiHabit && value === 0 && !isTimerRunning ? 'Avoided' : `${formatMs(value)} / ${dailyGoal || 1}m`}
            right={
                <Timer
                    initialMilliseconds={value}
                    showControls
                    onStart={() => setIsTimerRunning(true)}
                    onStop={(finalMs) => {
                        setIsTimerRunning(false);
                        onLog(finalMs);
                    }}
                />
            }
        />
    );
};

// -------------------------------------------------------------------
// Simple habit row
// -------------------------------------------------------------------
interface SimpleHabitRowProps {
    habitId: number;
    name: string;
    icon: React.ReactNode;
    accentColor: string;
    colorStops: ColorStop[];
    dailyGoal: number;
    value: number;
    streak: number;
    isAntiHabit?: boolean;
    onLog: (rating: number) => void;
    className?: string;
}

const SimpleHabitRow = ({
    name,
    icon,
    accentColor,
    colorStops,
    dailyGoal,
    value,
    streak,
    isAntiHabit,
    onLog,
    className,
}: SimpleHabitRowProps) => {
    const [isAnimating, setIsAnimating] = useState(false);

    const goal = dailyGoal || 1;
    const progress = Math.min(value / goal, 1);
    const isGoalMet = value >= goal;

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
        <HabitRow
            accentColor={accentColor}
            icon={icon}
            inactive={value === 0}
            name={name}
            badges={
                <>
                    <ProgressBadge progress={progress} isAntiHabit={isAntiHabit} />
                    <StreakBadge streak={streak} />
                </>
            }
            subtitle={isAntiHabit
                ? (value === 0 ? 'Avoided' : `${value} / ${goal} slips`)
                : `${value} / ${goal} completed`
            }
            right={
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
            }
            className={className}
        />
    );
};
