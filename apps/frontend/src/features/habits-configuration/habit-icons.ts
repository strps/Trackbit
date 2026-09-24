import { AlertTriangle, BookOpen, Briefcase, Code, Coffee, Droplet, Dumbbell, Heart, Home, Moon, Music, Star, Sun, Trees, XCircle, type LucideIcon } from "lucide-react";
import { HABIT_ICON_IDS, type HabitIconId } from "@trackbit/types";

const ICON_DEFS: Record<HabitIconId, { icon: LucideIcon; label: string }> = {
    book: { icon: BookOpen, label: 'Read' },
    dumbbell: { icon: Dumbbell, label: 'Fitness' },
    code: { icon: Code, label: 'Code' },
    water: { icon: Droplet, label: 'Health' },
    sun: { icon: Sun, label: 'Morning' },
    moon: { icon: Moon, label: 'Sleep' },
    music: { icon: Music, label: 'Creativity' },
    work: { icon: Briefcase, label: 'Work' },
    coffee: { icon: Coffee, label: 'Breaks' },
    ban: { icon: XCircle, label: 'Quit' },
    alert: { icon: AlertTriangle, label: 'Limit' },
    home: { icon: Home, label: 'Chores' },
    star: { icon: Star, label: 'Focus' },
    heart: { icon: Heart, label: 'Wellness' },
    trees: { icon: Trees, label: 'Nature' },
};

export const ICONS = HABIT_ICON_IDS.map((id) => ({ id, ...ICON_DEFS[id] }));

/** The icon component for a habit's stored icon id; the backend only accepts HABIT_ICON_IDS. */
export const getHabitIcon = (id: string): LucideIcon =>
    (ICON_DEFS[id as HabitIconId] ?? ICON_DEFS.star).icon;
