import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createExercise,
  type CreateExerciseInput,
  type ExerciseInfo,
} from "@/lib/tracker-api";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/context/auth-context";
import { exercisesKey } from "./use-tracker";

function handleApiError(err: unknown) {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "custom_exercise_limit_reached":
        Alert.alert(
          "Limit reached",
          `You've reached your custom exercise limit (${err.payload.maxCustomExercises}).`,
        );
        return;
      case "custom_exercise_frozen":
        Alert.alert(
          "Exercise frozen",
          "This custom exercise is frozen because your role limits were reduced.",
        );
        return;
    }
  }
  Alert.alert("Error", "Something went wrong. Please try again.");
}

export function useCreateExercise() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<ExerciseInfo, Error, CreateExerciseInput>({
    mutationFn: (input) => createExercise(input, token!),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: exercisesKey });
      const prevExercises = queryClient.getQueryData<ExerciseInfo[]>(exercisesKey);

      const optimistic: ExerciseInfo = {
        id: -Date.now(),
        userId: "",
        name: input.name,
        category: input.category,
        defaultWeightUnit: null,
        defaultDistanceUnit: null,
        frozen: false,
        lastPerformance: null,
      };

      queryClient.setQueryData<ExerciseInfo[]>(exercisesKey, (old) => [
        ...(old ?? []),
        optimistic,
      ]);

      return { prevExercises };
    },
    onError: (err, _input, context) => {
      const ctx = context as { prevExercises?: ExerciseInfo[] } | undefined;
      if (ctx?.prevExercises) queryClient.setQueryData(exercisesKey, ctx.prevExercises);
      handleApiError(err);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: exercisesKey });
    },
  });
}
