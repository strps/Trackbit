import { memo, useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
    Activity, Dumbbell, Book as MenuBook, Code,
    Star, Droplet, Trophy, Flame, Minus, Plus, ArrowRight,
    Check, ShieldAlert,
    CalendarSearch
} from 'lucide-react';
import { useTracker, type HabitWithLogs } from './use-tracker';
import { mapValueToColor, mapValueToColorOrdered } from '@/shared/utils/colorUtils';
import { ColorStop } from '@trackbit/types';
import { computeStreak, getColorAtOne, getHabitIcon } from './utils';
import { Button } from '@/shared/components/ui/button';
import { Timer } from '@/shared/components/Timer';
import { DateSelector } from '@/shared/components/DateSelector';
import { format, addDays, subDays, isAfter } from 'date-fns';
import { cn } from '@/shared/utils/utils';
import { DateTime } from 'luxon';
import { ProgressCounter } from '@/shared/components/ProgressCounter';
import { ComplexHabitRow } from './components/ExerciseHabitRow';
import { TimedHabitRow } from './components/TimedHabitRow';
import { CheckHabitRow } from './components/CheckHabitRow';
import { CountHabitRow } from './components/CountHabitRow';

// ---------------------------------------------------------------------------
// HabitRowWrapper — defined at module scope so React.memo can do stable
// component-type comparison.  Each instance only re-renders when its own
// `habit` prop reference changes (guaranteed by the shallow updateCache in
// use-tracker), so logging one habit never re-renders the rest.
// ---------------------------------------------------------------------------
interface HabitRowWrapperProps {
    habit: HabitWithLogs;
    selectedDay: string;
    logSimple: (payload: { rating: number; habitId?: number; day?: string }) => void;
}

const HabitRowWrapper = memo(({ habit, selectedDay, logSimple }: HabitRowWrapperProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const IconComponent = getHabitIcon(habit.icon);
    const icon = <IconComponent className="w-5 h-5 text-white" />;
    const accentColor = getColorAtOne(habit.colorStops);
    const streak = computeStreak(habit.dayLogs ?? {}, selectedDay, habit.type, habit.isAntiHabit);

    const goToSessions = async () => {
        const dayLogId = habit.dayLogs?.[selectedDay]?.id;
        if (dayLogId) {
            navigate(`/sessions?logId=${dayLogId}`);
            return;
        }
        try {
            const timeStamp = new Date().toISOString();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/tracker/day-logs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ habitId: habit.id, timeStamp }),
            });
            if (!res.ok) throw new Error('Failed to create day log');
            const newDayLog = await res.json();
            queryClient.setQueryData(['habit-logs'], (old: Record<number, any> | undefined) => {
                if (!old) return old;
                const updated = { ...old };
                const h = updated[habit.id];
                if (h) {
                    updated[habit.id] = {
                        ...h,
                        dayLogs: {
                            ...h.dayLogs,
                            [selectedDay]: {
                                id: newDayLog.id,
                                habitId: habit.id,
                                date: selectedDay,
                                localDay: selectedDay,
                                timeStamp: newDayLog.timeStamp ?? timeStamp,
                                createdAt: newDayLog.createdAt,
                                rating: newDayLog.rating ?? undefined,
                                notes: newDayLog.notes ?? undefined,
                                exerciseSessions: [],
                            },
                        },
                    };
                }
                return updated;
            });
            navigate(`/sessions?logId=${newDayLog.id}`);
        } catch (err) {
            console.error('Failed to create day log:', err);
        }
    };

    if (habit.type === 'complex') {
        const sessions = habit.dayLogs?.[selectedDay]?.exerciseSessions ?? [];
        return (
            <ComplexHabitRow
                name={habit.name}
                icon={icon}
                accentColor={accentColor}
                sessionsCount={sessions.length}
                sessions={sessions}
                streak={streak}
                onNavigate={goToSessions}
            />
        );
    }

    if (habit.type === 'timed') {
        const value = habit.dayLogs?.[selectedDay]?.rating || 0;
        return (
            <TimedHabitRow
                name={habit.name}
                icon={icon}
                accentColor={accentColor}
                dailyGoal={habit.dailyGoal}
                value={value}
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
                name={habit.name}
                icon={icon}
                accentColor={accentColor}
                checked={checked}
                streak={streak}
                isAntiHabit={habit.isAntiHabit}
                onToggle={() => logSimple({ rating: checked ? 0 : 1, habitId: habit.id, day: selectedDay })}
            />
        );
    }

    // Count habit
    const value = habit.dayLogs?.[selectedDay]?.rating || 0;
    return (
        <CountHabitRow
            habitId={habit.id}
            name={habit.name}
            icon={icon}
            accentColor={accentColor}
            colorStops={habit.colorStops}
            dailyGoal={habit.dailyGoal}
            value={value}
            streak={streak}
            isAntiHabit={habit.isAntiHabit}
            onLog={(rating) => logSimple({ rating, habitId: habit.id, day: selectedDay })}
        />
    );
});

// ---------------------------------------------------------------------------

const TrackerHome = () => {
    const { habitsWithLogs, isLoading, logSimple } = useTracker();
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

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex items-center gap-3 justify-between">
                        <DateSelector
                            selectedDay={selectedDay}
                            today={today}
                            onDateChange={handleDateChange}
                            onDateSelect={setSelectedDay}
                        />

                        <Button
                            variant="outline"
                            onClick={() => setSelectedDay(today)}
                            className="gap-1 h-10 w-10"
                            disabled={selectedDay === today}
                        >
                            <CalendarSearch className="w-4 h-4" />
                        </Button>

                    </div>
                </div>

                {/* Habits */}
                <div className="grid grid-cols-1 gap-3">
                    {regularHabits.map((habit) => (
                        <HabitRowWrapper key={habit.id} habit={habit} selectedDay={selectedDay} logSimple={logSimple} />
                    ))}
                </div>

                {/* Anti-Habits */}
                {antiHabits.length > 0 && (
                    <div className="space-y-3">
                        <h2 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5" />
                            Anti-Habits
                        </h2>
                        <div className="grid grid-cols-1 gap-3">
                            {antiHabits.map((habit) => (
                                <HabitRowWrapper key={habit.id} habit={habit} selectedDay={selectedDay} logSimple={logSimple} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TrackerHome;




