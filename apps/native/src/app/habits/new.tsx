import { useRouter } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { HabitForm, type HabitFormValues } from "@/components/habit-form";
import { useCreateHabit } from "@/hooks/use-create-habit";

export default function NewHabitScreen() {
  const router = useRouter();
  const { mutate, isPending } = useCreateHabit();

  function handleSubmit(values: HabitFormValues) {
    mutate(values, {
      onSuccess: () => router.back(),
    });
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <HabitForm onSubmit={handleSubmit} isSubmitting={isPending} submitLabel="Create habit" />
    </ThemedView>
  );
}
