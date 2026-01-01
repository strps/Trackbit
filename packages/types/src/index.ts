
export interface ColorStop {
    position: number;
    color: [number, number, number, number];
}

export interface Habit {
    id: number;
    userId: string;
    name: string;
    description: string | null;
    type: 'simple' | 'complex' | 'negative';
    colorTheme: 'green' | 'blue' | 'orange' | 'purple' | 'rose' | 'fire' | 'custom';
    colorStops: ColorStop[];
    icon: string;
    weeklyGoal: number;
    dailyGoal: number;
    createdAt: string | null;
}

export interface Exercise {
    id: number;
    userId: string | null;
    name: string;
    category: string;
    muscleGroup: string | null;
    defaultWeightUnit: string | null;
    defaultDistanceUnit: string | null;
    createdAt: string | null;
}

export interface ExerciseSession {
    id: number;
    habitId: number;
    date: string;
    createdAt: string | null;
}

export interface ExerciseLog {
    id: number;
    exerciseId: number;
    exerciseSessionId: number;
    createdAt: string | null;
    distance: number | null;
    duration: number | null;
    distanceUnit: string | null;
    weightUnit: string | null;
}

export interface ExercisePerformance {
    id: number;
    number: number;
    exerciseLogId: number;
    reps: number | null;
    weight: number | null;
    duration: number | null;
    distance: string | null;
    createdAt: string | null;
    rpe: number | null;
}