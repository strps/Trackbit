
// -------------------------------------------------------------------
// Tiered progress badge: Bronze → Silver → Gold

import { ShieldAlert, Trophy } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { BadgeIcon, BadgeParent, BadgeText } from "./BaseBadge";

// -------------------------------------------------------------------
export const ProgressBadge = ({ progress, isAntiHabit }: { progress: number; isAntiHabit?: boolean }) => {
    const Badge = isAntiHabit
        ? (
            progress <= 0
                ? (
                    <BadgeParent className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-400">
                        <BadgeIcon>
                            <ShieldAlert size={'1rem'} />
                        </BadgeIcon>
                        <BadgeText>Avoided</BadgeText>
                    </BadgeParent>
                )
                : (
                    <BadgeParent className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-400">
                        <BadgeIcon>
                            <ShieldAlert size={'1rem'} />
                        </BadgeIcon>
                        <BadgeText>Slipped</BadgeText>
                    </BadgeParent>
                )
        )
        : (
            progress <= 0
                ? null
                : progress >= 1
                    ? (
                        <BadgeParent className="bg-yellow-100 text-yellow-700 dark:bg-yellow-300 dark:text-yellow-900">
                            <BadgeIcon>
                                <Trophy size={'1rem'} />
                            </BadgeIcon>
                            <BadgeText>Done</BadgeText>
                        </BadgeParent>
                    )
                    : progress >= 0.5
                        ? (
                            <BadgeParent className="bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300">
                                <BadgeIcon>
                                    <Trophy size={'1rem'} />
                                </BadgeIcon>
                                <BadgeText>Halfway</BadgeText>
                            </BadgeParent>
                        )
                        : (
                            <BadgeParent className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-500">
                                <BadgeIcon>
                                    <Trophy size={'1rem'} />
                                </BadgeIcon>
                                <BadgeText>Started</BadgeText>
                            </BadgeParent>
                        )
        )

    return (
        <AnimatePresence>
            {Badge}
        </AnimatePresence>);
};
