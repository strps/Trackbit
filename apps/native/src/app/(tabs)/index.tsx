import { StyleSheet } from "react-native";
import { router } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { HabitList } from "@/components/habit-list";
import { useHabits } from "@/hooks/use-habits";
import { useLogHabit } from "@/hooks/use-log-habit";
import { useTodayLogs } from "@/hooks/use-today-logs";
import { useTodayHistory, useStartExerciseSession } from "@/hooks/use-tracker";
import { Spacing } from "@/constants/theme";

function formatToday(): string {
  return `Today, ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
}

export default function HabitsScreen() {
  const { data: habits = [], isLoading: habitsLoading, isFetching, refetch } = useHabits();
  const { data: history = [], isLoading: historyLoading, refetch: refetchHistory } = useTodayHistory();
  const { mutate: logHabit, isPending, variables } = useLogHabit();
  const { mutate: startSession, isPending: isStarting, variables: startingId } = useStartExerciseSession();
  useTodayLogs(); // populates todayRatingsKey in query client

  const isLoading = habitsLoading || historyLoading;
  const loggingId = isPending ? (variables?.habitId ?? null) : null;

  const historyMap = new Map(history.map((h) => [h.id, h]));
  const enrichedHabits = habits.map((h) =>
    h.type === "complex" ? (historyMap.get(h.id) ?? h) : h
  );

  function handleLog(habitId: number, rating: number) {
    logHabit({ habitId, rating, timeStamp: new Date().toISOString() });
  }

  function handleRefresh() {
    refetch();
    refetchHistory();
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
        habits={enrichedHabits}
        loggingId={loggingId}
        onLog={handleLog}
        onRefresh={handleRefresh}
        refreshing={isFetching && !isLoading}
        onStartSession={(habitId) =>
          startSession(habitId, {
            onSuccess: ({ session }) => router.push(`/session/${session.id}`),
          })
        }
        onOpenSession={(sessionId) => router.push(`/session/${sessionId}`)}
        startingSessionId={isStarting ? (startingId ?? null) : null}
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
