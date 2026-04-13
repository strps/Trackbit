// -------------------------------------------------------------------
// Timed habit row

import { ControlledTimer } from "@/shared/components/Timer";
import { Button } from "@/shared/components/ui/button";
import { BaseHabitRow } from "./BaseHabitRow";
import { ProgressBadge } from "./ProgressBadge";
import { StreakBadge } from "./StreakBadge";
import { useState } from "react";
import { Pause, Play } from "lucide-react";

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
    const [isRunning, setIsRunning] = useState(false);
    const [localMs, setLocalMs] = useState(value);

    // dailyGoal is in minutes for timed habits, value is in ms
    const goalMs = (dailyGoal || 1) * 60000;
    const timedProgress = Math.min(localMs / goalMs, 1);
    const inactive = localMs === 0 && !isRunning;

    const handleToggle = () => {
        if (isRunning) {
            setIsRunning(false);
            // onLog is called by ControlledTimer's onStop
        } else {
            setIsRunning(true);
        }
    };

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
            subtitle={isAntiHabit && localMs === 0 && !isRunning ? 'Avoided' : `${formatMs(localMs)} / ${dailyGoal || 1}m`}
            right={
                <div className="flex items-center gap-2 shrink-0">
                    <ControlledTimer
                        milliseconds={localMs}
                        isRunning={isRunning}
                        isEditable
                        showControls={false}
                        onMillisecondsChange={setLocalMs}
                        onStop={onLog}
                    />
                    <Button variant="outline" size="icon" onClick={handleToggle} className="shrink-0">
                        {isRunning
                            ? <Pause className="w-4 h-4" />
                            : <Play className={"w-4 h-4 " + (localMs > 0 ? "text-foreground" : "text-muted-foreground")} />
                        }
                    </Button>
                </div>
            }
        />
    );
};
