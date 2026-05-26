import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logHabit, type Habit, type LogHabitParams, type LogHabitResult } from "@/lib/habits-api";
import { useAuth } from "@/context/auth-context";
import { habitsQueryKey, loggedTodayKey } from "./use-habits";
import { todayRatingsKey } from "./use-today-logs";

export function useLogHabit() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<LogHabitResult, Error, LogHabitParams>({
    mutationFn: (params) => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return logHabit(params, token!, tz);
    },
    onMutate: async ({ habitId, rating }) => {
      await queryClient.cancelQueries({ queryKey: habitsQueryKey });
      const prevHabits = queryClient.getQueryData<Habit[]>(habitsQueryKey);
      const prevRatings = queryClient.getQueryData<Map<number, number>>(todayRatingsKey);

      queryClient.setQueryData<Set<number>>(loggedTodayKey, (old) => {
        const next = new Set(old ?? []);
        if (rating > 0) next.add(habitId);
        else next.delete(habitId);
        return next;
      });

      queryClient.setQueryData<Map<number, number>>(todayRatingsKey, (old) => {
        const next = new Map(old ?? []);
        next.set(habitId, rating);
        return next;
      });

      queryClient.setQueryData<Habit[]>(habitsQueryKey, (old) =>
        old?.map((h) =>
          h.id === habitId ? { ...h, loggedToday: rating > 0, todayRating: rating } : h,
        ) ?? [],
      );

      return { prevHabits, prevRatings, habitId };
    },
    onError: (_err, { habitId }, context) => {
      const ctx = context as { prevHabits?: Habit[]; prevRatings?: Map<number, number> } | undefined;
      if (ctx?.prevHabits) queryClient.setQueryData(habitsQueryKey, ctx.prevHabits);
      if (ctx?.prevRatings) queryClient.setQueryData(todayRatingsKey, ctx.prevRatings);
      queryClient.setQueryData<Set<number>>(loggedTodayKey, (old) => {
        const next = new Set(old ?? []);
        next.delete(habitId);
        return next;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitsQueryKey });
      queryClient.invalidateQueries({ queryKey: ["today-logs-fetch"] });
    },
  });
}
