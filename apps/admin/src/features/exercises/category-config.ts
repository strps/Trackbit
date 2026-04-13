import {
    Dumbbell,
    Activity,
    User,
    Scale,
    Ruler,
    Timer,
    Hash,
} from "lucide-react";

export const CATEGORY_CONFIG = [
    {
        value: "strength" as const,
        label: "Strength Training",
        icon: Dumbbell,
        description: "For lifting and resistance exercises.",
        fields: [
            { label: "Sets", icon: Hash },
            { label: "Reps", icon: Activity },
            { label: "Weight", icon: Scale },
        ],
        color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    },
    {
        value: "cardio" as const,
        label: "Cardio & Endurance",
        icon: Activity,
        description: "For running, cycling, and stamina.",
        fields: [
            { label: "Laps", icon: Hash },
            { label: "Distance", icon: Ruler },
            { label: "Duration", icon: Timer },
        ],
        color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    },
    {
        value: "flexibility" as const,
        label: "Flexibility & Balance",
        icon: User,
        description: "For yoga, stretching, and mobility.",
        fields: [{ label: "Duration", icon: Timer }],
        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    },
];

export const getCategoryConfig = (category: string) =>
    CATEGORY_CONFIG.find((c) => c.value === category) ?? CATEGORY_CONFIG[0];
