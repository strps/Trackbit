import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHabits, type Habit } from "@/lib/habits-api";
import { getHistory, type HabitWithHistory } from "@/lib/tracker-api";
import { useAuth } from "@/context/auth-context";
import { todayRatingsKey } from "./use-today-logs";

export const habitsQueryKey = ["habits"] as const;
export const habitHistoryKey = (start: string, end: string) =>
  ["habits", "history", start, end] as const;

export function useHabitHistory(start: string, end: string) {
  const { token } = useAuth();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return useQuery<HabitWithHistory[], Error>({
    queryKey: habitHistoryKey(start, end),
    queryFn: () => getHistory(token!, tz, start, end),
    enabled: token !== null,
    staleTime: 5 * 60 * 1000,
  });
}
export const loggedTodayKey = ["logged-today"] as const;

export function useHabits() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useQuery<Habit[], Error, Habit[]>({
    queryKey: habitsQueryKey,
    queryFn: () => getHabits(token!),
    enabled: token !== null,
    select: (habits) => {
      const logged = queryClient.getQueryData<Set<number>>(loggedTodayKey) ?? new Set<number>();
      const ratings = queryClient.getQueryData<Map<number, number>>(todayRatingsKey) ?? new Map<number, number>();
      return habits.map((h) => ({
        ...h,
        loggedToday: logged.has(h.id),
        todayRating: ratings.get(h.id),
      }));
    },
  });
}
