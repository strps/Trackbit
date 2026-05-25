import { useMutation, useQueryClient } from "@tanstack/react-query";
import { logHabit, type LogHabitParams, type LogHabitResult } from "@/lib/habits-api";
import { useAuth } from "@/context/auth-context";
import { habitsQueryKey } from "./use-habits";

export function useLogHabit() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<LogHabitResult, Error, LogHabitParams>({
    mutationFn: (params) => logHabit(params, token!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitsQueryKey });
    },
  });
}
