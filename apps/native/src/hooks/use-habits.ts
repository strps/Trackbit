import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getHabits, type Habit } from "@/lib/habits-api";
import { useAuth } from "@/context/auth-context";

export const habitsQueryKey = ["habits"] as const;
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
      return habits.map((h) => ({ ...h, loggedToday: logged.has(h.id) }));
    },
  });
}
