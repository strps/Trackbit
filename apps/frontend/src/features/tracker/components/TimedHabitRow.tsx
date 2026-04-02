// -------------------------------------------------------------------
// Timed habit row

import { Timer } from "@/shared/components/Timer";
import { BaseHabitRow } from "./BaseHabitRow";
import { ProgressBadge } from "./ProgressBadge";
import { StreakBadge } from "./StreakBadge";
import { useState } from "react";

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

export const TimedHabitRow = ({
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
        <BaseHabitRow
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
