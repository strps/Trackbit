// -------------------------------------------------------------------
// Complex habit row

import { Button } from "@/shared/components/ui/button";
import { BaseHabitRow } from "./BaseHabitRow";
import { ProgressBadge } from "./ProgressBadge";
import { StreakBadge } from "./StreakBadge";
import { ArrowRight, Play } from "lucide-react";

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

export const ComplexHabitRow = ({ name, icon, accentColor, sessionsCount, sessions, streak, onNavigate }: ComplexHabitRowProps) => {
    const hasExercises = sessions.some(s => (s.exerciseLogs?.length ?? 0) > 0);
    const inactive = sessionsCount === 0 || !hasExercises;
    return (
        <BaseHabitRow
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
                <Button variant="outline" size='icon' onClick={onNavigate} className="gap-2 shrink-0">

                    <Play className={"w-4 h-4" + (sessionsCount > 0 ? ' text-foreground' : ' text-muted-foreground')} />
                </Button>
            }
            inactive={inactive}
        />
    );
};
