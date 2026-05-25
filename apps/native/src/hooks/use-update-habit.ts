import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateHabit, type UpdateHabitInput, type Habit } from "@/lib/habits-api";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { habitsQueryKey } from "./use-habits";

function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "habit_frozen":
        Alert.alert(
          "Habit frozen",
          "This habit is frozen because your plan limits were reduced. Delete it or another to free a slot.",
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

export function useUpdateHabit() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<Habit, Error, { id: number; input: UpdateHabitInput }>({
    mutationFn: ({ id, input }) => updateHabit(id, input, token!),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: habitsQueryKey });
      const prevHabits = queryClient.getQueryData<Habit[]>(habitsQueryKey);

      queryClient.setQueryData<Habit[]>(habitsQueryKey, (old) =>
        old?.map((h) => (h.id === id ? { ...h, ...input } : h)) ?? [],
      );

      return { prevHabits };
    },
    onError: (err, _vars, context) => {
      const ctx = context as { prevHabits?: Habit[] } | undefined;
      if (ctx?.prevHabits) queryClient.setQueryData(habitsQueryKey, ctx.prevHabits);
      handleApiError(err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitsQueryKey });
    },
  });
}
