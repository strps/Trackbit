import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { HabitForm, type HabitFormValues } from "@/components/habit-form";
import { useHabits } from "@/hooks/use-habits";
import { useUpdateHabit } from "@/hooks/use-update-habit";
import { useDeleteHabit } from "@/hooks/use-delete-habit";
import { Spacing } from "@/constants/theme";

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habitId = Number(id);
  const router = useRouter();

  const { data: habits } = useHabits();
  const habit = habits?.find((h) => h.id === habitId);

  const { mutate: update, isPending: isUpdating } = useUpdateHabit();
  const { mutate: remove, isPending: isDeleting } = useDeleteHabit();

  if (!habit) return null;

  function handleSubmit(values: HabitFormValues) {
    update(
      { id: habitId, input: values },
      { onSuccess: () => router.back() },
    );
  }

  function handleDelete() {
    Alert.alert("Delete habit", `Delete "${habit!.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => remove(habitId, { onSuccess: () => router.back() }),
      },
    ]);
  }

  const isSubmitting = isUpdating || isDeleting;

  return (
    <ThemedView style={styles.flex}>
      <HabitForm
        initial={habit}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel="Save changes"
        frozen={habit.frozen}
      />
      <View style={styles.deleteRow}>
        <TouchableOpacity
          style={[styles.deleteBtn, { opacity: isSubmitting ? 0.5 : 1 }]}
          onPress={handleDelete}
          disabled={isSubmitting}
          activeOpacity={0.7}
        >
          <ThemedText style={styles.deleteText}>Delete habit</ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  deleteRow: {
    padding: Spacing.four,
    paddingTop: 0,
  },
  deleteBtn: {
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ef4444",
  },
  deleteText: {
    color: "#ef4444",
    fontWeight: "600",
    fontSize: 16,
  },
});
