// types/trackbit.d.ts
import {
    InsertHabit,
    SelectHabit,
    InsertDayLog,
    SelectDayLog,
    InsertExerciseSession,
    SelectExerciseSession,
    InsertExerciseLog,
    SelectExerciseLog,
    InsertExerciseSet,
    SelectExerciseSet,
    InsertUser,
    SelectUser,
    InsertAccount,
    SelectAccount,
    InsertSession,
    SelectSession,
    InsertVerification,
    SelectVerification,
    InsertExercise,
    SelectExercise,
} from "../backend/src/db/entitiesTypes";

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

    // All possible icon names (must match the mapping in getHabitIcon)
    export type HabitIcon = 'dumbbell' | 'code' | 'book' | 'star' | 'water' | 'alert';

    export type HabitType = 'simple' | 'complex' | 'negative'; //TODO, change name from negative to reduce

    // Re-export Drizzle-inferred types for habits and related entities
    export type Habit = SelectHabit;
    export type NewHabit = InsertHabit;

    export type DayLog = SelectDayLog;
    export type NewDayLog = InsertDayLog;

    export type ExerciseSession = SelectExerciseSession;
    export type NewExerciseSession = InsertExerciseSession;

    export type ExerciseLog = SelectExerciseLog;
    export type NewExerciseLog = InsertExerciseLog;

    export type ExerciseSet = SelectExerciseSet;
    export type NewExerciseSet = InsertExerciseSet;

    export type User = SelectUser;
    export type NewUser = InsertUser;

    export type Account = SelectAccount;
    export type NewAccount = InsertAccount;

    export type Session = SelectSession;
    export type NewSession = InsertSession;

    export type Verification = SelectVerification;
    export type NewVerification = InsertVerification;

    export type Exercise = SelectExercise;
    export type NewExercise = InsertExercise;

    export interface WorkoutSet {
        exerciseId: number;
        setNumber: number;
        reps?: number;
        weight?: number;
        weightUnit: string;
        distance?: number;
        duration?: number;
    }

    export interface GlobalStats {
        totalCount: number;
        currentStreak: number;
    }
}