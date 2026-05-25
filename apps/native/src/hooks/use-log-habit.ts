import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logHabit, type Habit, type LogHabitParams, type LogHabitResult } from "@/lib/habits-api";
import { useAuth } from "@/context/auth-context";
import { habitsQueryKey, loggedTodayKey } from "./use-habits";

export function useLogHabit() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<LogHabitResult, Error, LogHabitParams>({
    mutationFn: (params) => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return logHabit(params, token!, tz);
    },
    onMutate: async ({ habitId }) => {
      await queryClient.cancelQueries({ queryKey: habitsQueryKey });
      const prevHabits = queryClient.getQueryData<Habit[]>(habitsQueryKey);

      queryClient.setQueryData<Set<number>>(loggedTodayKey, (old) => {
        const next = new Set(old ?? []);
        next.add(habitId);
        return next;
      });

      queryClient.setQueryData<Habit[]>(habitsQueryKey, (old) =>
        old?.map((h) => (h.id === habitId ? { ...h, loggedToday: true } : h)) ?? [],
      );

      return { prevHabits, habitId };
    },
    onError: (_err, { habitId }, context) => {
      const ctx = context as { prevHabits?: Habit[] } | undefined;
      if (ctx?.prevHabits) {
        queryClient.setQueryData(habitsQueryKey, ctx.prevHabits);
      }
      queryClient.setQueryData<Set<number>>(loggedTodayKey, (old) => {
        const next = new Set(old ?? []);
        next.delete(habitId);
        return next;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitsQueryKey });
    },
  });
}
