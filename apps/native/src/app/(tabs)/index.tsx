import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { HabitList } from "@/components/habit-list";
import { useHabits } from "@/hooks/use-habits";
import { useLogHabit } from "@/hooks/use-log-habit";
import { useTodayLogs } from "@/hooks/use-today-logs";
import { Spacing } from "@/constants/theme";

function formatToday(): string {
  return `Today, ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
}

export default function HabitsScreen() {
  const { data: habits = [], isLoading, isFetching, refetch } = useHabits();
  const { mutate: logHabit, isPending, variables } = useLogHabit();
  useTodayLogs(); // populates todayRatingsKey in query client

  const loggingId = isPending ? (variables?.habitId ?? null) : null;

  function handleLog(habitId: number, rating: number) {
    logHabit({ habitId, rating, timeStamp: new Date().toISOString() });
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Loading habits…</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.dateHeader}>
        {formatToday()}
      </ThemedText>
      <HabitList
        habits={habits}
        loggingId={loggingId}
        onLog={handleLog}
        onRefresh={refetch}
        refreshing={isFetching && !isLoading}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dateHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    fontSize: 24,
    lineHeight: 32,
  },
});
