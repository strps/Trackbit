declare namespace Trackbit {
    // Define the core types used across the entire application (Frontend & Backend)

    export interface UserProfile {
        id: string; // Better-Auth User ID
        name: string;
        email: string;
        image?: string;
    }

    export type ColorStop = {
        /** Position along the gradient from 0.0 to 1.0 */
        position: number;
        /** RGB color values [red, green, blue] where each value is 0-255 */
        color: [number, number, number];
    };

    // All possible colors that can be set for a habit
    export type HabitColor = 'emerald' | 'blue' | 'violet' | 'orange' | 'rose' | 'amber';

    // All possible icon names (must match the mapping in getHabitIcon)
    export type HabitIcon = 'dumbbell' | 'code' | 'book' | 'star' | 'water' | 'alert';

    export type HabitType = 'simple' | 'complex' | 'negative'; //TODO, change anme from negative to reduce

    export interface Habit {
        id: number;
        userId: string;
        name: string;
        description?: string;
        type: HabitType;
        dailyGoal: number; // Weekly goal/limit
        weeklyGoal: number; // Weekly goal/limit
        colorStops: ColorStop[];
        icon: HabitIcon;
        createdAt: string;
    }

    export interface WorkoutSet {
        exerciseId: number;
        setNumber: number;
        reps?: number;
        weight?: number;
        weightUnit: string;
        distance?: number;
        duration?: number;
    }

    export interface DayLog {
        id: number;
        habitId: number;
        date: string; // YYYY-MM-DD
        rating?: number;
        notes?: string;
        // For complex logs, this is populated by the join with exercise_sets
        sets?: WorkoutSet[];
        createdAt?: string;
    }

    export interface GlobalStats {
        totalCount: number;
        currentStreak: number;
    }

}