// src/db/analytics.queries.ts
// Drizzle ORM query functions for the analytics endpoints
// These are server-side aggregations to support the recommended statistics.
// Adjust import paths as needed for your project structure.
// All queries should be filtered by the authenticated user's data (e.g., via exerciseSessions -> dayLogs -> habits.userId or exercises.userId).

import db from '../../db/db.js'; // Your Drizzle database instance
import { and, eq, gte, lte, sql, desc, asc } from 'drizzle-orm';
import {
    exercises,
    exerciseLogs,
    exercisePerformances,
    exerciseSessions,
    exerciseMuscleGroup,
    muscleGroups,
    dayLogs,
    habits,
} from '../../db/schema/index.js'; // Adjust to the correct path where your schema is defined

// Helper to restrict to user's data (assuming auth provides userId)
const userFilter = (userId: string) =>
    eq(habits.userId, userId); // Or join through dayLogs if needed

// 1. Global Overview (total sessions, volume, category distribution)
export const getAnalyticsOverview = async (
    userId: string,
    startDate?: string,
    endDate?: string
) => {
    const dateFilter = and(
        startDate ? gte(exerciseSessions.date, startDate) : undefined,
        endDate ? lte(exerciseSessions.date, endDate) : undefined
    );

    const [sessionCount, strengthVolume, categoryCounts] = await Promise.all([
        db
            .select({ count: sql<number>`count(DISTINCT ${exerciseSessions.id})` })
            .from(exerciseSessions)
            .innerJoin(dayLogs, eq(exerciseSessions.habitId, dayLogs.habitId) && eq(exerciseSessions.date, dayLogs.date))
            .innerJoin(habits, eq(dayLogs.habitId, habits.id))
            .where(and(dateFilter, userFilter(userId))),

        db
            .select({ total: sql<number>`coalesce(sum(${exercisePerformances.weight} * ${exercisePerformances.reps}), 0)` })
            .from(exercisePerformances)
            .innerJoin(exerciseLogs, eq(exercisePerformances.exerciseLogId, exerciseLogs.id))
            .innerJoin(exerciseSessions, eq(exerciseLogs.exerciseSessionId, exerciseSessions.id))
            .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
            .innerJoin(dayLogs, eq(exerciseSessions.habitId, dayLogs.habitId) && eq(exerciseSessions.date, dayLogs.date))
            .innerJoin(habits, eq(dayLogs.habitId, habits.id))
            .where(and(dateFilter, eq(exercises.category, 'strength'), userFilter(userId))),

        db
            .select({
                category: exercises.category,
                count: sql<number>`count(DISTINCT ${exerciseSessions.id})`,
            })
            .from(exerciseSessions)
            .innerJoin(exerciseLogs, eq(exerciseLogs.exerciseSessionId, exerciseSessions.id))
            .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
            .innerJoin(dayLogs, eq(exerciseSessions.habitId, dayLogs.habitId) && eq(exerciseSessions.date, dayLogs.date))
            .innerJoin(habits, eq(dayLogs.habitId, habits.id))
            .where(and(dateFilter, userFilter(userId)))
            .groupBy(exercises.category),
    ]);

    const categories = {
        strength: 0,
        cardio: 0,
        flexibility: 0,
    };
    categoryCounts.forEach((row) => {
        if (row.category) categories[row.category as keyof typeof categories] = Number(row.count);
    });

    return {
        totalSessions: Number(sessionCount[0]?.count || 0),
        totalStrengthVolume: Number(strengthVolume[0]?.total || 0),
        sessionsByCategory: categories,
    };
};

// 2. Progress for a specific exercise (line chart data)
export const getExerciseProgress = async (
    userId: string,
    exerciseId: number,
    startDate?: string,
    endDate?: string
) => {
    const dateFilter = and(
        startDate ? gte(exerciseSessions.date, startDate) : undefined,
        endDate ? lte(exerciseSessions.date, endDate) : undefined
    );

    return db
        .select({
            date: exerciseSessions.date,
            maxWeight: sql<number>`max(${exercisePerformances.weight})`,
            avgReps: sql<number>`avg(${exercisePerformances.reps})`,
            sessionVolume: sql<number>`sum(${exercisePerformances.weight} * ${exercisePerformances.reps})`,
            estimated1RM: sql<number>`max(${exercisePerformances.weight} * (1 + ${exercisePerformances.reps} / 30.0))`, // Epley formula
        })
        .from(exercisePerformances)
        .innerJoin(exerciseLogs, eq(exercisePerformances.exerciseLogId, exerciseLogs.id))
        .innerJoin(exerciseSessions, eq(exerciseLogs.exerciseSessionId, exerciseSessions.id))
        .innerJoin(dayLogs, eq(exerciseSessions.habitId, dayLogs.habitId) && eq(exerciseSessions.date, dayLogs.date))
        .innerJoin(habits, eq(dayLogs.habitId, habits.id))
        .where(and(eq(exerciseLogs.exerciseId, exerciseId), dateFilter, userFilter(userId)))
        .groupBy(exerciseSessions.date)
        .orderBy(asc(exerciseSessions.date));
};

// 3. Personal Records (FULLY FIXED - with proper aliases for raw SQL fields)
export const getPersonalRecords = async (userId: string, limit = 20) => {
    const subquery = db
        .select({
            exerciseName: exercises.name,
            weight: exercisePerformances.weight,
            reps: exercisePerformances.reps,
            tonnage: sql<number>`${exercisePerformances.weight} * ${exercisePerformances.reps}`.as('tonnage'),
            estimated1RM: sql<number>`${exercisePerformances.weight} * (1 + ${exercisePerformances.reps} / 30.0)`.as('estimated1RM'),
            date: exerciseSessions.date,
        })
        .from(exercisePerformances)
        .innerJoin(exerciseLogs, eq(exercisePerformances.exerciseLogId, exerciseLogs.id))
        .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
        .innerJoin(exerciseSessions, eq(exerciseLogs.exerciseSessionId, exerciseSessions.id))
        .innerJoin(
            dayLogs,
            and(
                eq(exerciseSessions.habitId, dayLogs.habitId),
                eq(exerciseSessions.date, dayLogs.date)
            )
        )
        .innerJoin(habits, eq(dayLogs.habitId, habits.id))
        .where(and(eq(exercises.category, 'strength'), eq(habits.userId, userId)))
        .as('pr_subquery');

    return db
        .select({
            exerciseName: subquery.exerciseName,
            weight: subquery.weight,
            reps: subquery.reps,
            tonnage: subquery.tonnage,
            estimated1RM: subquery.estimated1RM,
            date: subquery.date,
        })
        .from(subquery)
        .orderBy(desc(subquery.estimated1RM))
        .limit(limit);
};

// 4. Volume by Muscle Group (FULLY FIXED - with proper alias for raw SQL)
export const getVolumeByMuscleGroup = async (
    userId: string,
    startDate?: string,
    endDate?: string
) => {
    const dateFilter = and(
        startDate ? gte(exerciseSessions.date, startDate) : undefined,
        endDate ? lte(exerciseSessions.date, endDate) : undefined
    );

    const subquery = db
        .select({
            muscleGroup: muscleGroups.name,
            totalVolume: sql<number>`coalesce(sum(${exercisePerformances.weight} * ${exercisePerformances.reps}), 0)`.as('totalVolume'),
        })
        .from(muscleGroups)
        .leftJoin(exerciseMuscleGroup, eq(exerciseMuscleGroup.muscleGroupId, muscleGroups.id))
        .leftJoin(exercises, eq(exercises.id, exerciseMuscleGroup.exerciseId))
        .leftJoin(exerciseLogs, eq(exerciseLogs.exerciseId, exercises.id))
        .leftJoin(exercisePerformances, eq(exercisePerformances.exerciseLogId, exerciseLogs.id))
        .leftJoin(exerciseSessions, eq(exerciseLogs.exerciseSessionId, exerciseSessions.id))
        .innerJoin(
            dayLogs,
            and(
                eq(exerciseSessions.habitId, dayLogs.habitId),
                eq(exerciseSessions.date, dayLogs.date)
            )
        )
        .innerJoin(habits, eq(dayLogs.habitId, habits.id))
        .where(and(dateFilter, eq(habits.userId, userId)))
        .groupBy(muscleGroups.id, muscleGroups.name)
        .as('volume_subquery');

    return db
        .select({
            muscleGroup: subquery.muscleGroup,
            totalVolume: subquery.totalVolume,
        })
        .from(subquery)
        .orderBy(desc(subquery.totalVolume));
};

// 5. Cardio Summary
export const getCardioSummary = async (
    userId: string,
    startDate?: string,
    endDate?: string
) => {
    const dateFilter = and(
        startDate ? gte(exerciseSessions.date, startDate) : undefined,
        endDate ? lte(exerciseSessions.date, endDate) : undefined
    );

    const [totals] = await db
        .select({
            totalDistance: sql<number>`sum(${exerciseLogs.distance})`,
            totalDuration: sql<number>`sum(${exerciseLogs.duration})`, // seconds
            avgPace: sql<number>`avg(${exerciseLogs.distance} / nullif(${exerciseLogs.duration} / 3600.0, 0))`, // e.g., units per hour; adjust as needed
        })
        .from(exerciseLogs)
        .innerJoin(exercises, eq(exerciseLogs.exerciseId, exercises.id))
        .innerJoin(exerciseSessions, eq(exerciseLogs.exerciseSessionId, exerciseSessions.id))
        .innerJoin(dayLogs, eq(exerciseSessions.habitId, dayLogs.habitId) && eq(exerciseSessions.date, dayLogs.date))
        .innerJoin(habits, eq(dayLogs.habitId, habits.id))
        .where(and(eq(exercises.category, 'cardio'), dateFilter, userFilter(userId)));

    return {
        totalDistance: Number(totals?.totalDistance || 0),
        totalDurationSeconds: Number(totals?.totalDuration || 0),
        averagePace: Number(totals?.avgPace || 0),
    };
};