import { apiFetch } from "./api";
import type { Habit } from "./habits-api";

export interface ExercisePerformance {
  id: number;
  number: number;
  exerciseLogId: number;
  reps: number | null;
  weight: number | null;
  duration: number | null;
  distance: number | null;
  createdAt: string | null;
  rpe: number | null;
}

export interface ExerciseLog {
  id: number;
  exerciseId: number;
  exerciseSessionId: number;
  createdAt: string | null;
  exercisePerformances: ExercisePerformance[];
}

export interface ExerciseSession {
  id: number;
  dayLogId: number;
  createdAt: string | null;
  exerciseLogs: ExerciseLog[];
}

export interface DayLog {
  id: number;
  habitId: number;
  rating: number | null;
  timeStamp: string;
  createdAt: string | null;
  localDay: string;
  exerciseSessions: ExerciseSession[];
}

export interface HabitWithHistory extends Habit {
  dayLogs: DayLog[];
  frozen: boolean;
}

export interface ExerciseInfo {
  id: number;
  userId: string | null;
  name: string;
  category: string;
  defaultWeightUnit: string | null;
  defaultDistanceUnit: string | null;
  frozen: boolean;
  lastPerformance: {
    id: number | null;
    weight: number | null;
    reps: number | null;
    distance: number | null;
    duration: number | null;
    createdAt: string | null;
    rpe: number | null;
  } | null;
}

export type CreatePerformanceInput = {
  exerciseLogId: number;
  reps: number | null;
  weight: number | null;
  duration: number | null;
  distance: number | null;
  rpe: number | null;
  number: number;
};

export type UpdatePerformanceInput = Partial<
  Pick<ExercisePerformance, "reps" | "weight" | "duration" | "distance" | "rpe">
>;

export function getHistory(
  token: string,
  tz: string,
  start?: string,
  end?: string,
): Promise<HabitWithHistory[]> {
  const params = new URLSearchParams({ tz });
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return apiFetch<HabitWithHistory[]>(`/api/tracker/history?${params}`, { token });
}

export function createExerciseSession(
  dayLogId: number,
  token: string,
): Promise<{ id: number; dayLogId: number; createdAt: string | null }> {
  return apiFetch("/api/tracker/exercise-sessions", {
    method: "POST",
    body: { dayLogId },
    token,
  });
}

export function deleteExerciseSession(id: number, token: string): Promise<void> {
  return apiFetch(`/api/tracker/exercise-sessions/${id}`, { method: "DELETE", token });
}

export function addExerciseLog(
  payload: { exerciseSessionId: number; exerciseId: number },
  token: string,
): Promise<ExerciseLog> {
  return apiFetch("/api/tracker/exercise-logs", { method: "POST", body: payload, token });
}

export function removeExerciseLog(id: number, token: string): Promise<void> {
  return apiFetch(`/api/tracker/exercise-logs/${id}`, { method: "DELETE", token });
}

export function createPerformance(
  payload: CreatePerformanceInput,
  token: string,
): Promise<ExercisePerformance> {
  return apiFetch("/api/tracker/exercise-performances", { method: "POST", body: payload, token });
}

export function updatePerformance(
  id: number,
  payload: UpdatePerformanceInput,
  token: string,
): Promise<ExercisePerformance> {
  return apiFetch(`/api/tracker/exercise-performances/${id}`, {
    method: "PATCH",
    body: payload,
    token,
  });
}

export function deletePerformance(id: number, token: string): Promise<void> {
  return apiFetch(`/api/tracker/exercise-performances/${id}`, { method: "DELETE", token });
}

export function getExercises(token: string): Promise<ExerciseInfo[]> {
  return apiFetch<ExerciseInfo[]>("/api/exercise-info/exercises", { token });
}

export interface MuscleGroup {
  id: number;
  name: string;
  slug: string;
  parentId: number | null;
  level: number;
  displayOrder: number | null;
}

export type ExerciseCategory = "strength" | "cardio" | "flexibility";

export type CreateExerciseInput = {
  name: string;
  category: ExerciseCategory;
  description?: string;
  muscleGroups: number[];
};

export function getMuscleGroups(token: string): Promise<MuscleGroup[]> {
  return apiFetch<MuscleGroup[]>("/api/exercise-info/muscle-groups", { token });
}

export function createExercise(
  input: CreateExerciseInput,
  token: string,
): Promise<ExerciseInfo> {
  return apiFetch<ExerciseInfo>("/api/exercise-info/exercises", {
    method: "POST",
    body: input,
    token,
  });
}
