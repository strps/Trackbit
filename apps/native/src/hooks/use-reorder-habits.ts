import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { reorderHabits, type ReorderItem, type Habit } from "@/lib/habits-api";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { habitsQueryKey } from "./use-habits";

function handleApiError(err: unknown, queryClient: ReturnType<typeof useQueryClient>) {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "habit_frozen": {
        const frozenIds = err.payload.frozenIds as number[] | undefined;
        Alert.alert(
          "Habit frozen",
          frozenIds?.length
            ? "This habit is frozen because your plan limits were reduced. Delete it or another to free a slot."
            : "One or more habits are frozen and cannot be reordered.",
        );
        return;
      }
      case "habit_order_conflict":
        Alert.alert("Order conflict", "Another habit already uses this order. Please retry.");
        queryClient.invalidateQueries({ queryKey: habitsQueryKey });
        return;
    }
  }
  Alert.alert("Error", "Something went wrong. Please try again.");
}

export function useReorderHabits() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ success: true; updated: Habit[] }, Error, ReorderItem[]>({
    mutationFn: (items) => reorderHabits(items, token!),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: habitsQueryKey });
      const prevHabits = queryClient.getQueryData<Habit[]>(habitsQueryKey);

      const orderMap = new Map(items.map((i) => [i.id, i]));
      queryClient.setQueryData<Habit[]>(habitsQueryKey, (old) =>
        old?.map((h) => {
          const update = orderMap.get(h.id);
          return update ? { ...h, order: update.order, isAntiHabit: update.isAntiHabit } : h;
        }) ?? [],
      );

      return { prevHabits };
    },
    onError: (err, _items, context) => {
      const ctx = context as { prevHabits?: Habit[] } | undefined;
      if (ctx?.prevHabits) queryClient.setQueryData(habitsQueryKey, ctx.prevHabits);
      handleApiError(err, queryClient);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitsQueryKey });
    },
  });
}
