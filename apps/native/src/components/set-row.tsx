import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Check, Trash2 } from "lucide-react-native";

import { ThemedText } from "@/components/themed-text";
import { RpeSelector } from "@/components/rpe-selector";
import { useDeletePerformance, useUpdatePerformance } from "@/hooks/use-tracker";
import { type ExercisePerformance } from "@/lib/tracker-api";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

interface SetRowProps {
  performance: ExercisePerformance;
  weightUnit: string;
}

export function SetRow({ performance, weightUnit }: SetRowProps) {
  const theme = useTheme();
  const updatePerf = useUpdatePerformance();
  const deletePerf = useDeletePerformance();
  const [editing, setEditing] = useState(false);
  const [rpeOpen, setRpeOpen] = useState(false);
  const [repsText, setRepsText] = useState(
    performance.reps !== null ? String(performance.reps) : "",
  );
  const [weightText, setWeightText] = useState(
    performance.weight !== null ? String(performance.weight) : "",
  );
  const weightInputRef = useRef<TextInput>(null);
  const swipeRef = useRef<Swipeable>(null);

  const pending = performance.id < 0;

  useEffect(() => {
    if (!editing) {
      setRepsText(performance.reps !== null ? String(performance.reps) : "");
      setWeightText(performance.weight !== null ? String(performance.weight) : "");
    }
  }, [performance.reps, performance.weight, editing]);

  function saveEdits() {
    const reps = repsText.trim() === "" ? null : Number(repsText);
    const weight = weightText.trim() === "" ? null : Number(weightText);
    updatePerf.mutate({ id: performance.id, reps, weight });
    setEditing(false);
  }

  function formatValue() {
    const r = performance.reps;
    const w = performance.weight;
    if (r !== null && w !== null) return `${r} × ${w} ${weightUnit}`;
    if (r !== null) return `${r} reps`;
    if (w !== null) return `— × ${w} ${weightUnit}`;
    return "—";
  }

  const rowContent = (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.backgroundElement, opacity: pending ? 0.55 : 1 },
      ]}
    >
      <ThemedText type="small" themeColor="textSecondary" style={styles.setNum}>
        {performance.number}
      </ThemedText>

      {editing ? (
        <>
          <View style={styles.editBody}>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              value={repsText}
              onChangeText={setRepsText}
              keyboardType="numeric"
              placeholder="reps"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="next"
              onSubmitEditing={() => weightInputRef.current?.focus()}
              autoFocus
            />
            <ThemedText type="small" themeColor="textSecondary">
              ×
            </ThemedText>
            <TextInput
              ref={weightInputRef}
              style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
              value={weightText}
              onChangeText={setWeightText}
              keyboardType="numeric"
              placeholder="wt"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
              onSubmitEditing={saveEdits}
            />
            <ThemedText type="small" themeColor="textSecondary">
              {weightUnit}
            </ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.rpeEditBtn, { backgroundColor: theme.backgroundSelected }]}
            onPress={() => setRpeOpen(true)}
            activeOpacity={0.7}
          >
            <ThemedText type="small" themeColor="textSecondary">
              {performance.rpe !== null ? `RPE ${performance.rpe}` : "RPE"}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: theme.backgroundSelected }]}
            onPress={saveEdits}
            activeOpacity={0.7}
          >
            <Check size={15} color={theme.text} strokeWidth={2.5} />
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={styles.displayBody}
            onPress={() => !pending && setEditing(true)}
            activeOpacity={0.7}
          >
            <ThemedText type="default" numberOfLines={1}>
              {formatValue()}
            </ThemedText>
          </TouchableOpacity>
          {performance.rpe !== null && (
            <TouchableOpacity
              style={[styles.rpeBadge, { backgroundColor: theme.backgroundSelected }]}
              onPress={() => !pending && setRpeOpen(true)}
              activeOpacity={0.7}
            >
              <ThemedText type="small" themeColor="textSecondary">
                RPE {performance.rpe}
              </ThemedText>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );

  const rpeSheet = (
    <RpeSelector
      visible={rpeOpen}
      value={performance.rpe}
      onChange={(rpe) => updatePerf.mutate({ id: performance.id, rpe })}
      onClose={() => setRpeOpen(false)}
    />
  );

  if (pending) return rowContent;

  return (
    <>
      <Swipeable
        ref={swipeRef}
        renderRightActions={() => (
          <TouchableOpacity
            style={styles.deleteAction}
            onPress={() => {
              swipeRef.current?.close();
              deletePerf.mutate(performance.id);
            }}
            activeOpacity={0.8}
          >
            <Trash2 size={18} color="#fff" strokeWidth={2} />
          </TouchableOpacity>
        )}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
      >
        {rowContent}
      </Swipeable>
      {rpeSheet}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
    minHeight: 44,
  },
  setNum: {
    width: 20,
    textAlign: "center",
  },
  displayBody: {
    flex: 1,
  },
  editBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  input: {
    width: 64,
    height: 36,
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    fontSize: 15,
    textAlign: "center",
  },
  rpeBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rpeEditBtn: {
    height: 32,
    paddingHorizontal: Spacing.two,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteAction: {
    width: 56,
    backgroundColor: "#E5484D",
    alignItems: "center",
    justifyContent: "center",
  },
});
