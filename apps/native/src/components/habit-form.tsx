import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { z } from "zod";
import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { type Habit, type HabitType, type ColorTheme, type ColorStop } from "@/lib/habits-api";
import { COLOR_THEME_ACCENT, ICON_EMOJI } from "@/components/habit-row";

const PREDEFINED_GRADIENT_STOPS: ColorStop[] = [
  { position: 0, color: [99, 102, 241, 255] },
  { position: 0.5, color: [168, 85, 247, 255] },
  { position: 1, color: [236, 72, 153, 255] },
];

const HABIT_TYPES: { value: HabitType; label: string }[] = [
  { value: "count", label: "Count" },
  { value: "check", label: "Check" },
  { value: "timed", label: "Timed" },
  { value: "complex", label: "Complex" },
];

const COLOR_THEMES: ColorTheme[] = ["green", "blue", "orange", "purple", "rose", "fire", "custom"];

const ICON_KEYS = Object.keys(ICON_EMOJI);

const schema = z.object({
  name: z
    .string()
    .min(3, "Name must be at least 3 characters")
    .max(50, "Name must be at most 50 characters"),
  weeklyGoal: z.number().int().min(1).max(7),
  dailyGoal: z.number().min(1),
});

type FieldErrors = Partial<Record<"name" | "weeklyGoal" | "dailyGoal", string>>;

export interface HabitFormValues {
  name: string;
  type: HabitType;
  isAntiHabit: boolean;
  weeklyGoal: number;
  dailyGoal: number;
  icon: string;
  colorTheme: ColorTheme;
  colorStops: ColorStop[];
}

interface HabitFormProps {
  initial?: Partial<Habit>;
  onSubmit: (values: HabitFormValues) => void;
  isSubmitting: boolean;
  submitLabel?: string;
  frozen?: boolean;
}

export function HabitForm({
  initial,
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
  frozen = false,
}: HabitFormProps) {
  const theme = useTheme();

  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<HabitType>(initial?.type ?? "count");
  const [isAntiHabit, setIsAntiHabit] = useState(initial?.isAntiHabit ?? false);
  const [weeklyGoal, setWeeklyGoal] = useState(initial?.weeklyGoal ?? 5);
  const [dailyGoal, setDailyGoal] = useState(initial?.dailyGoal ?? 1);
  const [icon, setIcon] = useState(initial?.icon ?? "star");
  const [colorTheme, setColorTheme] = useState<ColorTheme>(initial?.colorTheme ?? "green");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const antiHabitAllowed = type === "count" || type === "check" || type === "timed";

  function handleSubmit() {
    const result = schema.safeParse({ name, weeklyGoal, dailyGoal });
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setFieldErrors({
        name: flat.name?.[0],
        weeklyGoal: flat.weeklyGoal?.[0],
        dailyGoal: flat.dailyGoal?.[0],
      });
      return;
    }
    setFieldErrors({});
    onSubmit({
      name,
      type,
      isAntiHabit: antiHabitAllowed ? isAntiHabit : false,
      weeklyGoal,
      dailyGoal,
      icon,
      colorTheme,
      colorStops: colorTheme === "custom" ? PREDEFINED_GRADIENT_STOPS : [],
    });
  }

  const inputStyle = (hasError: boolean) => [
    styles.input,
    {
      backgroundColor: theme.backgroundElement,
      color: theme.text,
      borderWidth: 1,
      borderColor: hasError ? "#ef4444" : "transparent",
    },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {frozen ? (
          <View style={[styles.frozenBanner, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={styles.frozenText}>🔒 This habit is frozen. Editing is disabled.</ThemedText>
          </View>
        ) : null}

        {/* Name */}
        <View style={styles.field}>
          <ThemedText type="smallBold" style={styles.label}>Name</ThemedText>
          <TextInput
            style={inputStyle(!!fieldErrors.name)}
            value={name}
            onChangeText={(v) => { setName(v); if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined })); }}
            placeholder="e.g. Morning run"
            placeholderTextColor={theme.textSecondary}
            maxLength={50}
            editable={!isSubmitting && !frozen}
          />
          {fieldErrors.name ? <ThemedText style={styles.fieldError}>{fieldErrors.name}</ThemedText> : null}
        </View>

        {/* Tracking method */}
        <View style={styles.field}>
          <ThemedText type="smallBold" style={styles.label}>Tracking method</ThemedText>
          <View style={styles.chipRow}>
            {HABIT_TYPES.map(({ value, label }) => {
              const active = type === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? "#3c87f7" : theme.backgroundElement },
                  ]}
                  onPress={() => !isSubmitting && !frozen && setType(value)}
                >
                  <ThemedText
                    style={[styles.chipText, { color: active ? "#fff" : theme.text }]}
                  >
                    {label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Anti-habit */}
        <View style={[styles.rowBetween, { backgroundColor: theme.backgroundElement, borderRadius: 10, padding: Spacing.three }]}>
          <ThemedText type="default">Anti-habit</ThemedText>
          <Switch
            value={antiHabitAllowed ? isAntiHabit : false}
            onValueChange={setIsAntiHabit}
            disabled={!antiHabitAllowed || isSubmitting || frozen}
            trackColor={{ true: "#3c87f7" }}
          />
        </View>

        {/* Daily goal */}
        <View style={styles.field}>
          <ThemedText type="smallBold" style={styles.label}>
            {type === "timed" ? "Daily goal (minutes)" : "Daily goal"}
          </ThemedText>
          <View style={styles.stepper}>
            <TouchableOpacity
              style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}
              onPress={() => !isSubmitting && !frozen && setDailyGoal((v) => Math.max(1, v - 1))}
            >
              <ThemedText style={styles.stepBtnText}>−</ThemedText>
            </TouchableOpacity>
            <ThemedText style={styles.stepValue}>{dailyGoal}</ThemedText>
            <TouchableOpacity
              style={[styles.stepBtn, { backgroundColor: theme.backgroundElement }]}
              onPress={() => !isSubmitting && !frozen && setDailyGoal((v) => v + 1)}
            >
              <ThemedText style={styles.stepBtnText}>+</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Weekly goal */}
        <View style={styles.field}>
          <ThemedText type="smallBold" style={styles.label}>Weekly goal (days)</ThemedText>
          <View style={styles.chipRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => {
              const active = weeklyGoal === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? "#3c87f7" : theme.backgroundElement },
                  ]}
                  onPress={() => !isSubmitting && !frozen && setWeeklyGoal(n)}
                >
                  <ThemedText style={[styles.chipText, { color: active ? "#fff" : theme.text }]}>
                    {n}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Icon picker */}
        <View style={styles.field}>
          <ThemedText type="smallBold" style={styles.label}>Icon</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconScroll}>
            <View style={styles.iconRow}>
              {ICON_KEYS.map((key) => {
                const active = icon === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.iconChip,
                      { backgroundColor: active ? "#3c87f7" : theme.backgroundElement },
                    ]}
                    onPress={() => !isSubmitting && !frozen && setIcon(key)}
                  >
                    <ThemedText style={styles.iconEmoji}>{ICON_EMOJI[key]}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Color preset */}
        <View style={styles.field}>
          <ThemedText type="smallBold" style={styles.label}>Color</ThemedText>
          <View style={styles.colorRow}>
            {COLOR_THEMES.map((ct) => {
              const active = colorTheme === ct;
              const accent = ct === "custom" ? "#818cf8" : COLOR_THEME_ACCENT[ct];
              return (
                <TouchableOpacity
                  key={ct}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: accent, borderWidth: active ? 3 : 0, borderColor: "#fff" },
                  ]}
                  onPress={() => !isSubmitting && !frozen && setColorTheme(ct)}
                />
              );
            })}
          </View>

          {/* Mock gradient editor */}
          {colorTheme === "custom" ? (
            <View style={styles.gradientMock}>
              <View
                style={[
                  styles.gradientBar,
                  { backgroundColor: undefined },
                ]}
              >
                {/* Simulate gradient with a LinearGradient-less bar */}
                <View style={[styles.gradientSegment, { backgroundColor: "rgb(99,102,241)", flex: 1 }]} />
                <View style={[styles.gradientSegment, { backgroundColor: "rgb(168,85,247)", flex: 1 }]} />
                <View style={[styles.gradientSegment, { backgroundColor: "rgb(236,72,153)", flex: 1 }]} />
              </View>
              <ThemedText themeColor="textSecondary" style={styles.gradientCaption}>
                Custom gradient editor coming soon
              </ThemedText>
            </View>
          ) : null}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { opacity: isSubmitting || frozen ? 0.6 : 1 }]}
          onPress={handleSubmit}
          disabled={isSubmitting || frozen}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.submitText}>
            {isSubmitting ? "Saving…" : submitLabel}
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  frozenBanner: {
    borderRadius: 10,
    padding: Spacing.three,
  },
  frozenText: {
    color: "#f59e0b",
    fontSize: 14,
  },
  field: { gap: Spacing.two },
  label: { marginBottom: 2 },
  input: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  fieldError: { color: "#ef4444", fontSize: 13 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipText: { fontSize: 14, fontWeight: "500" },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontSize: 22, fontWeight: "400", lineHeight: 26 },
  stepValue: { fontSize: 18, fontWeight: "600", minWidth: 32, textAlign: "center" },
  iconScroll: { flexGrow: 0 },
  iconRow: { flexDirection: "row", gap: Spacing.two, paddingVertical: Spacing.one },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconEmoji: { fontSize: 22, lineHeight: 26 },
  colorRow: { flexDirection: "row", gap: Spacing.two + Spacing.one },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  gradientMock: { marginTop: Spacing.two, gap: Spacing.two },
  gradientBar: {
    height: 40,
    borderRadius: 10,
    flexDirection: "row",
    overflow: "hidden",
  },
  gradientSegment: { height: "100%" },
  gradientCaption: { fontSize: 12, textAlign: "center" },
  submitBtn: {
    backgroundColor: "#3c87f7",
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginTop: Spacing.two,
  },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
