import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteHabit, type Habit } from "@/lib/habits-api";
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
    }
  }
  Alert.alert("Error", "Something went wrong. Please try again.");
}

export function useDeleteHabit() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<{ success: true; deletedId: number }, Error, number>({
    mutationFn: (id) => deleteHabit(id, token!),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: habitsQueryKey });
      const prevHabits = queryClient.getQueryData<Habit[]>(habitsQueryKey);

      queryClient.setQueryData<Habit[]>(habitsQueryKey, (old) =>
        old?.filter((h) => h.id !== id) ?? [],
      );

      return { prevHabits };
    },
    onError: (err, _id, context) => {
      const ctx = context as { prevHabits?: Habit[] } | undefined;
      if (ctx?.prevHabits) queryClient.setQueryData(habitsQueryKey, ctx.prevHabits);
      handleApiError(err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitsQueryKey });
    },
  });
}
