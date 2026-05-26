import { StyleSheet, TouchableOpacity, View } from "react-native";
import {
  Ban, BookOpen, Briefcase, Coffee, Code, Droplets,
  Dumbbell, Heart, House, Moon, Music, Star, Sun, Trees, Trophy,
  type LucideIcon,
} from "lucide-react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { type Habit, type ColorTheme } from "@/lib/habits-api";

export const COLOR_THEME_ACCENT: Record<ColorTheme, string> = {
  green: "#22c55e",
  blue: "#3b82f6",
  orange: "#f97316",
  purple: "#a855f7",
  rose: "#f43f5e",
  fire: "#ef4444",
  custom: "#3b82f6",
};

export const ICON_COMPONENTS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  code: Code,
  book: BookOpen,
  star: Star,
  water: Droplets,
  alert: Trophy,
  sun: Sun,
  moon: Moon,
  music: Music,
  work: Briefcase,
  coffee: Coffee,
  ban: Ban,
  home: House,
  heart: Heart,
  trees: Trees,
};

interface HabitIconProps {
  name: string;
  size?: number;
  color?: string;
}

export function HabitIcon({ name, size = 20, color = "#ffffff" }: HabitIconProps) {
  const Icon = ICON_COMPONENTS[name] ?? Star;
  return <Icon size={size} color={color} strokeWidth={2} />;
}

function accentColor(habit: Habit): string {
  if (habit.colorTheme === "custom" && habit.colorStops.length > 0) {
    const mid = habit.colorStops[Math.floor(habit.colorStops.length / 2)];
    const [r, g, b] = mid.color;
    return `rgb(${r}, ${g}, ${b})`;
  }
  return COLOR_THEME_ACCENT[habit.colorTheme];
}

interface HabitRowProps {
  habit: Habit;
  onLog: (habitId: number) => void;
  isLogging: boolean;
}

export function HabitRow({ habit, onLog, isLogging }: HabitRowProps) {
  const theme = useTheme();
  const accent = accentColor(habit);
  const interactive = !habit.frozen && !isLogging;

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}
      onPress={() => onLog(habit.id)}
      disabled={!interactive}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconCircle,
          { backgroundColor: habit.frozen ? theme.backgroundSelected : accent },
        ]}
      >
        <HabitIcon name={habit.icon} size={20} color="#ffffff" />
      </View>

      <View style={styles.label}>
        <ThemedText
          type="default"
          themeColor={habit.frozen ? "textSecondary" : "text"}
          numberOfLines={1}
        >
          {habit.name}
        </ThemedText>
      </View>

      <View style={styles.status}>
        {habit.frozen ? (
          <ThemedText style={styles.statusEmoji}>🔒</ThemedText>
        ) : habit.loggedToday ? (
          <View style={[styles.checkCircle, { backgroundColor: accent }]}>
            <ThemedText style={styles.checkMark}>✓</ThemedText>
          </View>
        ) : (
          <View style={[styles.emptyCircle, { borderColor: theme.backgroundSelected }]} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: 12,
    marginVertical: Spacing.one,
    gap: Spacing.three,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
  },
  status: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  statusEmoji: {
    fontSize: 16,
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  emptyCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
});
