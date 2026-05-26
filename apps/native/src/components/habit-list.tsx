import { FlatList, RefreshControl, StyleSheet } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { HabitRow } from "@/components/habit-row";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { type Habit } from "@/lib/habits-api";

type ListItem =
  | { type: "header"; title: string; key: string }
  | { type: "habit"; habit: Habit; key: string };

interface HabitListProps {
  habits: Habit[];
  loggingId: number | null;
  onLog: (habitId: number, rating: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export function HabitList({ habits, loggingId, onLog, onRefresh, refreshing }: HabitListProps) {
  const theme = useTheme();

  const active = habits.filter((h) => !h.frozen);
  const frozen = habits.filter((h) => h.frozen);

  const items: ListItem[] = [];
  if (active.length > 0) {
    items.push({ type: "header", title: "Active", key: "header-active" });
    active.forEach((h) => items.push({ type: "habit", habit: h, key: `habit-${h.id}` }));
  }
  if (frozen.length > 0) {
    items.push({ type: "header", title: "Frozen", key: "header-frozen" });
    frozen.forEach((h) => items.push({ type: "habit", habit: h, key: `habit-${h.id}` }));
  }

  if (items.length === 0) {
    return (
      <ThemedView style={styles.empty}>
        <ThemedText style={styles.emptyEmoji}>🌱</ThemedText>
        <ThemedText type="default" themeColor="textSecondary">
          No habits yet
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
          Add habits from the web app to get started.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.key}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.textSecondary}
        />
      }
      renderItem={({ item }) => {
        if (item.type === "header") {
          return (
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeader}>
              {item.title}
            </ThemedText>
          );
        }
        return (
          <HabitRow
            habit={item.habit}
            onLog={onLog}
            isLogging={loggingId === item.habit.id}
            onNavigate={() => {}}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
  },
  sectionHeader: {
    marginTop: Spacing.three,
    marginBottom: Spacing.one,
    paddingHorizontal: Spacing.one,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    padding: Spacing.four,
  },
  emptyEmoji: {
    fontSize: 48,
    lineHeight: 56,
  },
  emptyHint: {
    textAlign: "center",
  },
});
