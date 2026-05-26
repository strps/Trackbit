import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useEffect } from "react";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

const SHEET_HEIGHT = 340;

export const RPE_LABELS: Record<number, string> = {
  1: "Very Easy",
  2: "Easy",
  3: "Moderate",
  4: "Somewhat Hard",
  5: "Hard",
  6: "Hard+",
  7: "Very Hard",
  8: "Very Hard+",
  9: "Extremely Hard",
  10: "Max Effort",
};

function getRpeZoneColor(level: number): string {
  if (level <= 3) return "#10B981";
  if (level <= 6) return "#FBBF24";
  if (level <= 8) return "#F97316";
  return "#EF4444";
}

interface RpeSelectorProps {
  visible: boolean;
  value: number | null;
  onChange: (value: number | null) => void;
  onClose: () => void;
}

export function RpeSelector({ visible, value, onChange, onClose }: RpeSelectorProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(SHEET_HEIGHT);

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

  function handlePick(level: number) {
    onChange(value === level ? null : level);
    handleClose();
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

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
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: theme.backgroundSelected }]} />
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.title}>
            Rate of Perceived Exertion
          </ThemedText>

          <View style={styles.grid}>
            {Array.from({ length: 10 }, (_, i) => {
              const level = i + 1;
              const zone = getRpeZoneColor(level);
              const active = value === level;
              return (
                <TouchableOpacity
                  key={level}
                  activeOpacity={0.7}
                  onPress={() => handlePick(level)}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: active ? zone : theme.backgroundSelected,
                      borderColor: active ? zone : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cellText,
                      { color: active ? "#fff" : theme.text },
                    ]}
                  >
                    {level}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <ThemedText
            type="small"
            themeColor="textSecondary"
            style={styles.labelRow}
          >
            {value !== null ? RPE_LABELS[value] : " "}
          </ThemedText>
        </Animated.View>
      </View>
    </Modal>
  );
}

const CELL_SIZE = 56;

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
  title: {
    textAlign: "center",
    marginTop: Spacing.one,
    marginBottom: Spacing.three,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: {
    fontSize: 20,
    fontWeight: "700",
  },
  labelRow: {
    textAlign: "center",
    fontStyle: "italic",
    marginTop: Spacing.three,
    minHeight: 20,
  },
});
