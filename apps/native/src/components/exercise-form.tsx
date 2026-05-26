import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { z } from "zod";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useMuscleGroups } from "@/hooks/use-muscle-groups";
import type { CreateExerciseInput, ExerciseCategory } from "@/lib/tracker-api";

const DESCRIPTION_MAX = 500;

const CATEGORIES: { value: ExerciseCategory; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "cardio", label: "Cardio" },
  { value: "flexibility", label: "Flexibility" },
];

const schema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(80, "Name must be at most 80 characters"),
  description: z.string().max(DESCRIPTION_MAX).optional(),
});

type FieldErrors = Partial<Record<"name" | "description", string>>;

export type ExerciseFormValues = CreateExerciseInput;

interface ExerciseFormProps {
  onSubmit: (values: ExerciseFormValues) => void;
  isSubmitting: boolean;
  submitLabel?: string;
}

export function ExerciseForm({
  onSubmit,
  isSubmitting,
  submitLabel = "Save",
}: ExerciseFormProps) {
  const theme = useTheme();
  const muscleGroupsQuery = useMuscleGroups();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ExerciseCategory>("strength");
  const [description, setDescription] = useState("");
  const [selectedMuscleGroups, setSelectedMuscleGroups] = useState<Set<number>>(
    () => new Set(),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const sortedMuscleGroups = useMemo(() => {
    const rows = muscleGroupsQuery.data ?? [];
    return [...rows].sort((a, b) => {
      const ao = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const bo = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
      if (ao !== bo) return ao - bo;
      return a.name.localeCompare(b.name);
    });
  }, [muscleGroupsQuery.data]);

  function toggleMuscleGroup(id: number) {
    if (isSubmitting) return;
    setSelectedMuscleGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedDescription = description.trim();
    const result = schema.safeParse({
      name: trimmedName,
      description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
    });
    if (!result.success) {
      const flat = result.error.flatten().fieldErrors;
      setFieldErrors({
        name: flat.name?.[0],
        description: flat.description?.[0],
      });
      return;
    }
    setFieldErrors({});
    onSubmit({
      name: trimmedName,
      category,
      description: trimmedDescription.length > 0 ? trimmedDescription : undefined,
      muscleGroups: Array.from(selectedMuscleGroups),
    });
  }

  const canSubmit = name.trim().length > 0 && !isSubmitting;

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
        {/* Name */}
        <View style={styles.field}>
          <ThemedText type="smallBold" style={styles.label}>Name</ThemedText>
          <TextInput
            style={inputStyle(!!fieldErrors.name)}
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (fieldErrors.name) setFieldErrors((p) => ({ ...p, name: undefined }));
            }}
            placeholder="e.g. Cable row"
            placeholderTextColor={theme.textSecondary}
            maxLength={80}
            editable={!isSubmitting}
          />
          {fieldErrors.name ? (
            <ThemedText style={styles.fieldError}>{fieldErrors.name}</ThemedText>
          ) : null}
        </View>

        {/* Category */}
        <View style={styles.field}>
          <ThemedText type="smallBold" style={styles.label}>Category</ThemedText>
          <View style={styles.chipRow}>
            {CATEGORIES.map(({ value, label }) => {
              const active = category === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? "#3c87f7" : theme.backgroundElement },
                  ]}
                  onPress={() => !isSubmitting && setCategory(value)}
                >
                  <ThemedText style={[styles.chipText, { color: active ? "#fff" : theme.text }]}>
                    {label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <ThemedText type="smallBold" style={styles.label}>Description (optional)</ThemedText>
          <TextInput
            style={[
              inputStyle(!!fieldErrors.description),
              styles.textarea,
            ]}
            value={description}
            onChangeText={(v) => {
              setDescription(v);
              if (fieldErrors.description) {
                setFieldErrors((p) => ({ ...p, description: undefined }));
              }
            }}
            placeholder="Notes, form cues, equipment…"
            placeholderTextColor={theme.textSecondary}
            maxLength={DESCRIPTION_MAX}
            editable={!isSubmitting}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <ThemedText themeColor="textSecondary" style={styles.counter}>
            {description.length} / {DESCRIPTION_MAX}
          </ThemedText>
        </View>

        {/* Muscle groups */}
        <View style={styles.field}>
          <ThemedText type="smallBold" style={styles.label}>Muscle groups</ThemedText>
          {muscleGroupsQuery.isLoading ? (
            <ActivityIndicator color={theme.text} />
          ) : muscleGroupsQuery.isError ? (
            <ThemedText themeColor="textSecondary">
              Failed to load muscle groups.
            </ThemedText>
          ) : sortedMuscleGroups.length === 0 ? (
            <ThemedText themeColor="textSecondary">No muscle groups available.</ThemedText>
          ) : (
            <View style={styles.chipRow}>
              {sortedMuscleGroups.map((group) => {
                const active = selectedMuscleGroups.has(group.id);
                return (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.chip,
                      { backgroundColor: active ? "#3c87f7" : theme.backgroundElement },
                    ]}
                    onPress={() => toggleMuscleGroup(group.id)}
                  >
                    <ThemedText
                      style={[styles.chipText, { color: active ? "#fff" : theme.text }]}
                    >
                      {group.name}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, { opacity: canSubmit ? 1 : 0.6 }]}
          onPress={handleSubmit}
          disabled={!canSubmit}
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
  field: { gap: Spacing.two },
  label: { marginBottom: 2 },
  input: {
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  textarea: {
    minHeight: 100,
  },
  fieldError: { color: "#ef4444", fontSize: 13 },
  counter: { fontSize: 12, textAlign: "right" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  chip: {
    borderRadius: 8,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipText: { fontSize: 14, fontWeight: "500" },
  submitBtn: {
    backgroundColor: "#3c87f7",
    borderRadius: 10,
    paddingVertical: Spacing.three,
    alignItems: "center",
    marginTop: Spacing.two,
  },
  submitText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
