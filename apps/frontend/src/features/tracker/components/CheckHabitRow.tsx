// -------------------------------------------------------------------
// Check habit row

import { cn } from "@/shared/utils/utils";
import { useTranslation } from "react-i18next";
import { BaseHabitRow } from "./BaseHabitRow";
import { ProgressBadge } from "./ProgressBadge";
import { StreakBadge } from "./StreakBadge";
import { Check } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

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

export const CheckHabitRow = ({
    name,
    icon,
    accentColor,
    checked,
    streak,
    isAntiHabit,
    onToggle,
}: CheckHabitRowProps) => {
    const { t } = useTranslation('tracker');
    // Anti-habit: inactive (grayed) when NOT checked (success = avoided)
    const inactive = isAntiHabit ? !checked : !checked;
    const subtitle = isAntiHabit
        ? (checked ? t('badge_slipped') : t('badge_avoided'))
        : (checked ? t('check_completed') : t('check_not_yet'));

    return (
        <BaseHabitRow
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
                <Button
                    onClick={onToggle}
                    size='icon'
                    variant='outline'
                    className={checked ? 'hover:border-muted-foreground/50 scale-100' : undefined}
                    style={checked ? { backgroundColor: accentColor } : undefined}
                    aria-label={checked ? t('mark_incomplete') : t('mark_complete')}
                >
                    <Check
                        className={cn(
                            'transition-all duration-300 ease-out',
                            checked
                                ? 'w-8 h-8 text-foreground scale-100'
                                : 'w-6 h-6 text-muted-foreground  scale-90'
                        )}
                        strokeWidth={checked ? 3.5 : 2}
                    />
                </Button>
            }
        />
    );
};
