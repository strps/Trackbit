

// -------------------------------------------------------------------
// Simple habit row

import { mapValueToColorOrdered } from "@/shared/utils/colorUtils";
import { useTranslation } from "react-i18next";
import { ColorStop } from "@trackbit/types";
import { useEffect, useState } from "react";
import { BaseHabitRow } from "./BaseHabitRow";
import { ProgressBadge } from "./ProgressBadge";
import { StreakBadge } from "./StreakBadge";
import { CompactProgressCounter, ProgressCounter } from "@/shared/components/ProgressCounter";

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

export const CountHabitRow = ({
    name,
    icon,
    accentColor,
    colorStops,
    dailyGoal: goal,
    value,
    streak,
    isAntiHabit,
    onLog,
    className,
}: SimpleHabitRowProps) => {
    const { t } = useTranslation('tracker');
    const [isAnimating, setIsAnimating] = useState(false);

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
        <BaseHabitRow
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
                ? (value === 0 ? t('badge_avoided') : t('count_slips', { value, goal }))
                : t('count_completed', { value, goal })
            }
            right={
                <CompactProgressCounter onDecrement={() => onLog(value - 1)} onIncrement={() => onLog(value + 1)} value={value} goal={goal} isGoalMet={isGoalMet} colorString={colorString} />
            }
            className={className}
        />
    );
};
