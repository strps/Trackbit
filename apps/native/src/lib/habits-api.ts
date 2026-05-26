import { apiFetch } from "./api";

export type HabitType = "count" | "complex" | "negative" | "timed" | "check";
export type ColorTheme = "green" | "blue" | "orange" | "purple" | "rose" | "fire" | "custom";
export type ColorStop = { position: number; color: [number, number, number, number] };

export interface CreateHabitInput {
  name: string;
  description?: string;
  type?: HabitType;
  isAntiHabit?: boolean;
  weeklyGoal?: number;
  dailyGoal?: number;
  colorTheme?: ColorTheme;
  colorStops?: ColorStop[];
  icon?: string;
  order?: number;
}

export type UpdateHabitInput = Partial<CreateHabitInput>;

export interface ReorderItem {
  id: number;
  order: number;
  isAntiHabit: boolean;
}

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
  loggedToday?: boolean;
  todayRating?: number;
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

export interface TodayLog {
  habitId: number;
  rating: number;
  id: number;
}

export function getTodayLogs(token: string, tz: string): Promise<TodayLog[]> {
  const today = new Date().toISOString().slice(0, 10);
  return apiFetch<Array<{ id: number; dayLogs: Array<{ id: number; habitId: number; rating: number | null }> }>>(
    `/api/tracker/history?start=${today}&end=${today}&tz=${encodeURIComponent(tz)}`,
    { token },
  ).then((habits) =>
    habits.flatMap((h) =>
      h.dayLogs.map((dl) => ({ habitId: dl.habitId, rating: dl.rating ?? 0, id: dl.id })),
    ),
  );
}

export function logHabit(params: LogHabitParams, token: string, tz?: string): Promise<LogHabitResult> {
  const query = tz ? `?tz=${encodeURIComponent(tz)}` : "";
  return apiFetch<LogHabitResult>(`/api/tracker/check${query}`, {
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

export function createHabit(input: CreateHabitInput, token: string): Promise<Habit> {
  return apiFetch<Habit>("/api/habits", { method: "POST", body: input, token });
}

export function updateHabit(id: number, input: UpdateHabitInput, token: string): Promise<Habit> {
  return apiFetch<Habit>(`/api/habits/${id}`, { method: "PUT", body: input, token });
}

export function deleteHabit(id: number, token: string): Promise<{ success: true; deletedId: number }> {
  return apiFetch(`/api/habits/${id}`, { method: "DELETE", token });
}

export function reorderHabits(
  items: ReorderItem[],
  token: string,
): Promise<{ success: true; updated: Habit[] }> {
  return apiFetch("/api/habits/reorder", { method: "PATCH", body: { items }, token });
}
