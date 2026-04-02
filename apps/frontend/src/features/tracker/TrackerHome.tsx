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
import { computeStreak, getColorAtOne, getHabitIcon } from './utils';
import { Button } from '@/shared/components/ui/button';
import { Timer } from '@/shared/components/Timer';
import { format, addDays, subDays, isAfter } from 'date-fns';
import { cn } from '@/shared/utils/utils';
import { DateTime } from 'luxon';
import { ProgressCounter } from '@/shared/components/ProgressCounter';
import { ComplexHabitRow } from './components/ExerciseHabitRow';
import { TimedHabitRow } from './components/TimedHabitRow';
import { CheckHabitRow } from './components/CheckHabitRow';
import { CountHabitRow } from './components/CountHabitRow';

const TrackerHome = () => {
    const { habitsWithLogs, isLoading, logSimple } = useTracker();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const today = DateTime.now().toISODate();
    const [searchParams, setSearchParams] = useSearchParams();

    const [selectedDay, setSelectedDay] = useState(searchParams.get('date') ?? today);
    const [timeZone] = useState(searchParams.get('time_zone') ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
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
            <CountHabitRow
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
                        {/* {selectedDay !== today && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedDay(today)}
                                className="gap-1"
                            >
                                Today
                                <CalendarSearch className="w-4 h-4" />
                            </Button>
                        )} */}
                    </div>
                </div>

                {/* Habits */}
                <div className="grid grid-cols-1 gap-3">
                    {regularHabits.map((habit) => renderHabitRow(habit))}
                </div>

                {/* Anti-Habits */}
                {antiHabits.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
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




