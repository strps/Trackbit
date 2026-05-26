import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SectionList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Dumbbell, Play, Search, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { useAddExerciseLog, useExercises } from "@/hooks/use-tracker";
import { type ExerciseInfo } from "@/lib/tracker-api";

const SHEET_HEIGHT = 560;
const ACCENT = "#6E54F7";
type Tab = "search" | "favorites" | "program";

interface ExercisePickerProps {
  visible: boolean;
  exerciseSessionId: number;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Exercise row
// ---------------------------------------------------------------------------

interface ExerciseRowProps {
  exercise: ExerciseInfo;
  onAdd: (exercise: ExerciseInfo) => void;
}

function ExerciseRow({ exercise, onAdd }: ExerciseRowProps) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      style={[styles.exerciseRow, { backgroundColor: theme.background }]}
      activeOpacity={0.7}
      onPress={() => onAdd(exercise)}
    >
      <View style={[styles.exerciseIcon, { backgroundColor: theme.backgroundSelected }]}>
        <Dumbbell size={16} color={theme.textSecondary} strokeWidth={2} />
      </View>
      <View style={styles.exerciseBody}>
        <ThemedText type="default" numberOfLines={1}>
          {exercise.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {exercise.category}
        </ThemedText>
      </View>
      <View style={[styles.playBtn, { backgroundColor: theme.backgroundSelected }]}>
        <Play size={16} color={theme.text} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Picker sheet
// ---------------------------------------------------------------------------

export function ExercisePicker({ visible, exerciseSessionId, onClose }: ExercisePickerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const translateY = useSharedValue(SHEET_HEIGHT);

  const { data: exercises = [] } = useExercises();
  const addLog = useAddExerciseLog();

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 22, stiffness: 220 });
    } else {
      translateY.value = SHEET_HEIGHT;
    }
  }, [visible]);

  function handleClose() {
    translateY.value = withTiming(SHEET_HEIGHT, { duration: 220 }, (finished) => {
      if (finished) runOnJS(onClose)();
    });
  }

  function handleAdd(exercise: ExerciseInfo) {
    addLog.mutate({ exerciseSessionId, exerciseId: exercise.id });
    handleClose();
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const sections = useMemo(() => {
    if (query) {
      const filtered = exercises.filter((e) =>
        e.name.toLowerCase().includes(query.toLowerCase())
      );
      return [{ title: "", data: filtered }];
    }
    const recommended = exercises.filter((e) => e.lastPerformance !== null).slice(0, 3);
    const rest = exercises.filter((e) => !recommended.includes(e));
    const result: { title: string; data: ExerciseInfo[] }[] = [];
    if (recommended.length > 0) result.push({ title: "Recommended", data: recommended });
    result.push({ title: recommended.length > 0 ? "All exercises" : "", data: rest });
    return result;
  }, [exercises, query]);

  const tabs: { key: Tab; label: string; Icon: typeof Search }[] = [
    { key: "search", label: "Search", Icon: Search },
    { key: "favorites", label: "Favorites", Icon: Star },
    { key: "program", label: "Program", Icon: Dumbbell },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={handleClose}
        />

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: theme.backgroundElement, paddingBottom: insets.bottom },
            animatedStyle,
          ]}
        >
          {/* Drag handle */}
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />
          </View>

          {/* Tab bar */}
          <View style={[styles.tabBar, { borderBottomColor: theme.backgroundSelected }]}>
            {tabs.map(({ key, label, Icon }) => {
              const active = tab === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.tabBtn,
                    { borderBottomColor: active ? ACCENT : "transparent" },
                  ]}
                  onPress={() => setTab(key)}
                  activeOpacity={0.7}
                >
                  <Icon
                    size={18}
                    color={active ? ACCENT : theme.textSecondary}
                    strokeWidth={2}
                  />
                  <ThemedText
                    type="small"
                    style={active ? { color: ACCENT } : undefined}
                    themeColor={active ? undefined : "textSecondary"}
                  >
                    {label}
                  </ThemedText>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Search tab */}
          {tab === "search" && (
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View
                style={[styles.searchRow, { backgroundColor: theme.background }]}
              >
                <Search size={16} color={theme.textSecondary} strokeWidth={2} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search exercises…"
                  placeholderTextColor={theme.textSecondary}
                  value={query}
                  onChangeText={setQuery}
                  autoCorrect={false}
                  clearButtonMode="while-editing"
                />
              </View>

              <SectionList
                sections={sections}
                keyExtractor={(e) => String(e.id)}
                renderItem={({ item }) => <ExerciseRow exercise={item} onAdd={handleAdd} />}
                renderSectionHeader={({ section: { title } }) =>
                  title ? (
                    <View
                      style={[
                        styles.sectionHeader,
                        { backgroundColor: theme.backgroundElement },
                      ]}
                    >
                      <ThemedText type="small" themeColor="textSecondary">
                        {title}
                      </ThemedText>
                    </View>
                  ) : null
                }
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                stickySectionHeadersEnabled={false}
              />
            </KeyboardAvoidingView>
          )}

          {/* Favorites tab (mocked) */}
          {tab === "favorites" && (
            <View style={styles.emptyState}>
              <Star size={36} color={theme.textSecondary} strokeWidth={1.5} />
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Favorites coming soon.
              </ThemedText>
            </View>
          )}

          {/* Program tab (mocked) */}
          {tab === "program" && (
            <View style={styles.emptyState}>
              <Dumbbell size={36} color={theme.textSecondary} strokeWidth={1.5} />
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                Program coming soon.
              </ThemedText>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handleRow: {
    alignItems: "center",
    paddingVertical: Spacing.two,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.two,
    gap: Spacing.one,
    borderBottomWidth: 2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Platform.OS === "ios" ? Spacing.two : Spacing.one,
    borderRadius: 10,
    gap: Spacing.two,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  exerciseRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderRadius: 12,
    marginVertical: Spacing.one,
    gap: Spacing.two,
  },
  exerciseIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseBody: {
    flex: 1,
    gap: 2,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  emptyText: {
    textAlign: "center",
  },
});
