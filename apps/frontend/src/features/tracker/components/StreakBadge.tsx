import { Flame } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { BadgeIcon, BadgeParent, BadgeText } from "./BaseBadge";

export const StreakBadge = ({ streak }: { streak: number }) => (
    <AnimatePresence>
        {streak >= 2 && (
            <BadgeParent className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-400">
                <BadgeIcon>
                    <Flame size="1rem" />
                </BadgeIcon>
                <BadgeText>{`${streak} day streak`}</BadgeText>
            </BadgeParent>
        )}
    </AnimatePresence>
);
