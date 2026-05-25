import { apiFetch } from "./api";

export type HabitType = "count" | "complex" | "negative" | "timed" | "check";
export type ColorTheme = "green" | "blue" | "orange" | "purple" | "rose" | "fire" | "custom";
export type ColorStop = { position: number; color: [number, number, number, number] };

export interface Habit {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  type: HabitType;
  isAntiHabit: boolean;
  colorTheme: ColorTheme;
  colorStops: ColorStop[];
  icon: string;
  weeklyGoal: number;
  dailyGoal: number;
  order: number;
  createdAt: string | null;
  frozen: boolean;
}

export interface LogHabitParams {
  habitId: number;
  rating: number;
  timeStamp: string;
}

export interface LogHabitResult {
  success: boolean;
  id: number;
  habitId: number;
}

export function getHabits(token: string): Promise<Habit[]> {
  return apiFetch<Habit[]>("/api/habits", { token });
}

export function logHabit(params: LogHabitParams, token: string): Promise<LogHabitResult> {
  return apiFetch<LogHabitResult>("/api/tracker/check", {
    method: "POST",
    body: params,
    token,
  });
}

export function deleteHabitLog(id: number, token: string): Promise<void> {
  return apiFetch<void>(`/api/tracker/day-logs/${id}`, {
    method: "DELETE",
    token,
  });
}
