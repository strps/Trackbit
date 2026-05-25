import { useQuery } from "@tanstack/react-query";
import { getHabits, type Habit } from "@/lib/habits-api";
import { useAuth } from "@/context/auth-context";

export const habitsQueryKey = ["habits"] as const;

export function useHabits() {
  const { token } = useAuth();

  return useQuery<Habit[]>({
    queryKey: habitsQueryKey,
    queryFn: () => getHabits(token!),
    enabled: token !== null,
  });
}
