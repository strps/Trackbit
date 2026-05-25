import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useHabits } from "@/hooks/use-habits";
import { useDeleteHabit } from "@/hooks/use-delete-habit";
import { useReorderHabits } from "@/hooks/use-reorder-habits";
import { type Habit } from "@/lib/habits-api";
import { COLOR_THEME_ACCENT, ICON_EMOJI } from "@/components/habit-row";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

type ListItem =
  | { kind: "header"; title: string; key: string }
  | { kind: "habit"; habit: Habit; key: string };

function buildList(habits: Habit[]): ListItem[] {
  const regular = habits.filter((h) => !h.isAntiHabit).sort((a, b) => a.order - b.order);
  const anti = habits.filter((h) => h.isAntiHabit).sort((a, b) => a.order - b.order);
  const items: ListItem[] = [];
  if (regular.length > 0) {
    items.push({ kind: "header", title: "Habits", key: "header-habits" });
    regular.forEach((h) => items.push({ kind: "habit", habit: h, key: `h-${h.id}` }));
  }
  if (anti.length > 0) {
    items.push({ kind: "header", title: "Anti-habits", key: "header-anti" });
    anti.forEach((h) => items.push({ kind: "habit", habit: h, key: `a-${h.id}` }));
  }
  return items;
}

function recomputeOrder(items: ListItem[]): { id: number; order: number; isAntiHabit: boolean }[] {
  let regularIdx = 0;
  let antiIdx = 0;
  const result: { id: number; order: number; isAntiHabit: boolean }[] = [];
  items.forEach((item) => {
    if (item.kind !== "habit") return;
    const { habit } = item;
    if (habit.isAntiHabit) {
      result.push({ id: habit.id, order: antiIdx++, isAntiHabit: true });
    } else {
      result.push({ id: habit.id, order: regularIdx++, isAntiHabit: false });
    }
  });
  return result;
}

export default function ManageHabitsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { data: habits = [] } = useHabits();
  const { mutate: reorder } = useReorderHabits();
  const { mutate: remove } = useDeleteHabit();

  const listData = buildList(habits);

  function handleDelete(habit: Habit) {
    Alert.alert("Delete habit", `Delete "${habit.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => remove(habit.id),
      },
    ]);
  }

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ListItem>) => {
      if (item.kind === "header") {
        return (
          <View style={styles.sectionHeader}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {item.title.toUpperCase()}
            </ThemedText>
          </View>
        );
      }

      const { habit } = item;
      const accent =
        habit.colorTheme === "custom" && habit.colorStops.length > 0
          ? (() => {
              const mid = habit.colorStops[Math.floor(habit.colorStops.length / 2)];
              const [r, g, b] = mid.color;
              return `rgb(${r},${g},${b})`;
            })()
          : COLOR_THEME_ACCENT[habit.colorTheme];
      const emoji = ICON_EMOJI[habit.icon] ?? "⭐";

      return (
        <ScaleDecorator>
          <View
            style={[
              styles.row,
              {
                backgroundColor: isActive ? theme.backgroundSelected : theme.backgroundElement,
                opacity: habit.frozen ? 0.6 : 1,
              },
            ]}
          >
            {/* Drag handle */}
            <TouchableOpacity
              onLongPress={habit.frozen ? undefined : drag}
              disabled={habit.frozen}
              style={styles.dragHandle}
              accessibilityLabel="Drag to reorder"
            >
              <ThemedText themeColor="textSecondary" style={styles.dragIcon}>
                ☰
              </ThemedText>
            </TouchableOpacity>

            {/* Icon */}
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: habit.frozen ? theme.backgroundSelected : accent },
              ]}
            >
              <ThemedText style={styles.iconEmoji}>{emoji}</ThemedText>
            </View>

            {/* Name — tap to edit */}
            <TouchableOpacity
              style={styles.nameArea}
              onPress={() => router.push(`/habits/${habit.id}/edit` as never)}
              activeOpacity={0.7}
            >
              <ThemedText
                numberOfLines={1}
                themeColor={habit.frozen ? "textSecondary" : "text"}
              >
                {habit.name}
              </ThemedText>
              {habit.frozen ? <ThemedText style={styles.lockBadge}>🔒</ThemedText> : null}
            </TouchableOpacity>

            {/* Delete */}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(habit)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={`Delete ${habit.name}`}
            >
              <ThemedText style={styles.deleteText}>✕</ThemedText>
            </TouchableOpacity>
          </View>
        </ScaleDecorator>
      );
    },
    [habits, theme, router],
  );

  function handleDragEnd({ data }: { data: ListItem[] }) {
    const reorderItems = recomputeOrder(data);
    if (reorderItems.length > 0) reorder(reorderItems);
  }

  return (
    <ThemedView style={styles.flex}>
      <DraggableFlatList
        data={listData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        onDragEnd={handleDragEnd}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: "#3c87f7" }]}
            onPress={() => router.push("/habits/new" as never)}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.addBtnText}>+ New habit</ThemedText>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText themeColor="textSecondary">No habits yet. Tap + to add one.</ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: Spacing.three, gap: Spacing.two },
  sectionHeader: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    paddingVertical: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.two,
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  dragHandle: {
    paddingHorizontal: Spacing.two,
    justifyContent: "center",
    alignItems: "center",
  },
  dragIcon: { fontSize: 18 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 16, lineHeight: 20 },
  nameArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  lockBadge: { fontSize: 14 },
  deleteBtn: {
    paddingHorizontal: Spacing.two,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteText: { color: "#ef4444", fontSize: 16, fontWeight: "700" },
  addBtn: {
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginBottom: Spacing.three,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  empty: {
    alignItems: "center",
    marginTop: Spacing.six,
  },
});
