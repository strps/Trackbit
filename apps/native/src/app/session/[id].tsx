import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect } from "react";
import { Dumbbell } from "lucide-react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useActiveSession, type EnrichedExerciseLog } from "@/hooks/use-tracker";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

// --- Exercise log row (placeholder for set-row.tsx component) ---

interface ExerciseLogRowProps {
  log: EnrichedExerciseLog;
}

function ExerciseLogRow({ log }: ExerciseLogRowProps) {
  const theme = useTheme();
  const setCount = log.exercisePerformances.length;

  return (
    <View style={[styles.logRow, { backgroundColor: theme.backgroundElement }]}>
      <View style={[styles.logIcon, { backgroundColor: theme.backgroundSelected }]}>
        <Dumbbell size={16} color={theme.textSecondary} strokeWidth={2} />
      </View>
      <View style={styles.logBody}>
        <ThemedText type="default" numberOfLines={1}>
          {log.exercise?.name ?? `Exercise #${log.exerciseId}`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {setCount === 0 ? "No sets logged" : `${setCount} set${setCount === 1 ? "" : "s"}`}
        </ThemedText>
      </View>
    </View>
  );
}

// --- Screen ---

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id ? Number(id) : null;
  const navigation = useNavigation();
  const theme = useTheme();

  const { isLoading, isFetching, refetch, habit, session, enrichedLogs, totalSets } =
    useActiveSession(sessionId);

  useEffect(() => {
    if (habit) {
      navigation.setOptions({ title: habit.name });
    }
  }, [habit, navigation]);

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!session) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Session not found.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.summary}>
        <ThemedText type="small" themeColor="textSecondary">
          {enrichedLogs.length === 0
            ? "No exercises yet"
            : `${enrichedLogs.length} exercise${enrichedLogs.length === 1 ? "" : "s"} · ${totalSets} set${totalSets === 1 ? "" : "s"}`}
        </ThemedText>
      </View>

      <FlatList
        data={enrichedLogs}
        keyExtractor={(l) => String(l.id)}
        contentContainerStyle={styles.list}
        refreshing={isFetching && !isLoading}
        onRefresh={refetch}
        renderItem={({ item }) => <ExerciseLogRow log={item} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Dumbbell size={36} color={theme.textSecondary} strokeWidth={1.5} />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              Add exercises to start logging sets.
            </ThemedText>
          </View>
        }
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
  summary: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    flexGrow: 1,
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: 12,
    marginVertical: Spacing.one,
    gap: Spacing.three,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logBody: {
    flex: 1,
    gap: 2,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing.six,
    gap: Spacing.two,
  },
  emptyText: {
    textAlign: "center",
  },
});
