import { Flame } from "lucide-react";

export const StreakBadge = ({ streak }: { streak: number }) => {
    if (streak < 2) return null;
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
            <Flame className="w-3 h-3 mr-0.5" /> {streak} day streak
        </span>
    );
};
