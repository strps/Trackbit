import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createHabit, type CreateHabitInput, type Habit } from "@/lib/habits-api";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { habitsQueryKey } from "./use-habits";

function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "habit_limit_reached":
        Alert.alert(
          "Limit reached",
          `You've reached your habit limit (${err.payload.maxHabits}).`,
        );
        return;
      case "habit_type_not_allowed": {
        const allowed = (err.payload.allowedHabitTypes as string[] | undefined)?.join(", ");
        Alert.alert(
          "Type not allowed",
          `Your plan doesn't allow this habit type. Allowed: ${allowed}.`,
        );
        return;
      }
      case "habit_order_conflict":
        Alert.alert("Order conflict", "Another habit already uses this order. Please retry.");
        return;
    }
  }
  Alert.alert("Error", "Something went wrong. Please try again.");
}

export function useCreateHabit() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<Habit, Error, CreateHabitInput>({
    mutationFn: (input) => {
      const cached = queryClient.getQueryData<Habit[]>(habitsQueryKey) ?? [];
      // Filter out optimistic entries (negative IDs) to get the real count
      const realCount = cached.filter((h) => h.id > 0).length;
      return createHabit({ ...input, order: input.order ?? realCount }, token!);
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: habitsQueryKey });
      const prevHabits = queryClient.getQueryData<Habit[]>(habitsQueryKey);

      const optimistic: Habit = {
        id: -Date.now(),
        userId: "",
        name: input.name,
        description: input.description ?? null,
        type: input.type ?? "count",
        isAntiHabit: input.isAntiHabit ?? false,
        colorTheme: input.colorTheme ?? "green",
        colorStops: input.colorStops ?? [],
        icon: input.icon ?? "star",
        weeklyGoal: input.weeklyGoal ?? 5,
        dailyGoal: input.dailyGoal ?? 1,
        order: input.order ?? (prevHabits?.length ?? 0),
        createdAt: null,
        frozen: false,
        loggedToday: false,
      };

      queryClient.setQueryData<Habit[]>(habitsQueryKey, (old) => [...(old ?? []), optimistic]);

      return { prevHabits };
    },
    onError: (err, _input, context) => {
      const ctx = context as { prevHabits?: Habit[] } | undefined;
      if (ctx?.prevHabits) queryClient.setQueryData(habitsQueryKey, ctx.prevHabits);
      handleApiError(err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitsQueryKey });
    },
  });
}
