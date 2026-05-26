import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useState } from "react";
import { Dumbbell, Plus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ExercisePicker } from "@/components/exercise-picker";
import { SetRow } from "@/components/set-row";
import { useActiveSession, useCreatePerformance, type EnrichedExerciseLog } from "@/hooks/use-tracker";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

// --- Exercise log card with per-set rows ---

interface ExerciseLogRowProps {
  log: EnrichedExerciseLog;
}

function ExerciseLogRow({ log }: ExerciseLogRowProps) {
  const theme = useTheme();
  const createPerf = useCreatePerformance();
  const weightUnit = log.exercise?.defaultWeightUnit ?? "kg";
  const performances = log.exercisePerformances;

  function handleAddSet() {
    const prev = performances[performances.length - 1] ?? null;
    createPerf.mutate({
      exerciseLogId: log.id,
      number: performances.length + 1,
      reps: prev?.reps ?? null,
      weight: prev?.weight ?? null,
      duration: null,
      distance: null,
      rpe: null,
    });
  }

  return (
    <View style={[styles.logCard, { backgroundColor: theme.backgroundElement }]}>
      {/* Header */}
      <View style={styles.logHeader}>
        <View style={[styles.logIcon, { backgroundColor: theme.backgroundSelected }]}>
          <Dumbbell size={16} color={theme.textSecondary} strokeWidth={2} />
        </View>
        <View style={styles.logBody}>
          <ThemedText type="default" numberOfLines={1}>
            {log.exercise?.name ?? `Exercise #${log.exerciseId}`}
          </ThemedText>
          {log.exercise?.category ? (
            <ThemedText type="small" themeColor="textSecondary">
              {log.exercise.category}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {/* Set rows */}
      {performances.map((perf) => (
        <SetRow key={perf.id} performance={perf} weightUnit={weightUnit} />
      ))}

      {/* Add set */}
      <TouchableOpacity
        style={styles.addSetBtn}
        onPress={handleAddSet}
        activeOpacity={0.7}
        disabled={createPerf.isPending}
      >
        <Plus size={14} color={theme.textSecondary} strokeWidth={2.5} />
        <ThemedText type="small" themeColor="textSecondary">
          Add set
        </ThemedText>
      </TouchableOpacity>
    </View>
  );
}

// --- Screen ---

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id ? Number(id) : null;
  const navigation = useNavigation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [pickerVisible, setPickerVisible] = useState(false);

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
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 72 }]}
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

      <TouchableOpacity
        style={[
          styles.addBtn,
          { bottom: insets.bottom + Spacing.three, backgroundColor: theme.backgroundElement },
        ]}
        onPress={() => setPickerVisible(true)}
        activeOpacity={0.8}
      >
        <Plus size={18} color={theme.text} strokeWidth={2.5} />
        <ThemedText type="default" style={styles.addBtnLabel}>
          Add exercise
        </ThemedText>
      </TouchableOpacity>

      {session && (
        <ExercisePicker
          visible={pickerVisible}
          exerciseSessionId={session.id}
          onClose={() => setPickerVisible(false)}
        />
      )}
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
  logCard: {
    borderRadius: 12,
    marginVertical: Spacing.one,
    overflow: "hidden",
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
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
  addSetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing.six,
    gap: Spacing.two,
  },
  emptyText: {
    textAlign: "center",
  },
  addBtn: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  addBtnLabel: {
    fontWeight: "600",
  },
});
