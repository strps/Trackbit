import { useRouter } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ExerciseForm, type ExerciseFormValues } from "@/components/exercise-form";
import { useCreateExercise } from "@/hooks/use-create-exercise";

export default function NewExerciseScreen() {
  const router = useRouter();
  const { mutate, isPending } = useCreateExercise();

  function handleSubmit(values: ExerciseFormValues) {
    mutate(values, {
      onSuccess: () => router.back(),
    });
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ExerciseForm
        onSubmit={handleSubmit}
        isSubmitting={isPending}
        submitLabel="Create exercise"
      />
    </ThemedView>
  );
}
