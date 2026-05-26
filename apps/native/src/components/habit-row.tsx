import { useState, useRef, useEffect } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  Ban, BookOpen, Briefcase, Coffee, Code, Droplets,
  Dumbbell, Heart, House, Lock, Moon, Music, Star, Sun, Trees, Trophy,
  Check, Minus, Plus, Play, Pause, ChevronRight,
  type LucideIcon,
} from "lucide-react-native";
import { ThemedText } from "@/components/themed-text";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";
import { type Habit, type ColorTheme } from "@/lib/habits-api";
import type { DayLog } from "@/lib/tracker-api";

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

export function accentColor(habit: Habit): string {
  if (habit.colorTheme === "custom" && habit.colorStops.length > 0) {
    const mid = habit.colorStops[Math.floor(habit.colorStops.length / 2)];
    const [r, g, b] = mid.color;
    return `rgb(${r}, ${g}, ${b})`;
  }
  return COLOR_THEME_ACCENT[habit.colorTheme];
}

// ---------------------------------------------------------------------------
// Shared row shell
// ---------------------------------------------------------------------------

interface BaseRowProps {
  habit: Habit;
  accent: string;
  subtitle: string;
  inactive?: boolean;
  right: React.ReactNode;
}

function BaseRow({ habit, accent, subtitle, inactive, right }: BaseRowProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.backgroundElement, opacity: inactive ? 0.55 : 1 },
      ]}
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
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>

      <View style={styles.rightSlot}>{right}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Check habit row (check / negative types)
// ---------------------------------------------------------------------------

interface CheckHabitRowProps {
  habit: Habit;
  onLog: (habitId: number, rating: number) => void;
  isLogging: boolean;
}

export function CheckHabitRow({ habit, onLog, isLogging }: CheckHabitRowProps) {
  const theme = useTheme();
  const accent = accentColor(habit);
  const checked = !!habit.loggedToday;
  const interactive = !habit.frozen && !isLogging;

  const subtitle = habit.isAntiHabit
    ? checked ? "Slipped" : "Avoided"
    : checked ? "Completed" : "Not yet";

  return (
    <BaseRow
      habit={habit}
      accent={accent}
      subtitle={subtitle}
      inactive={!checked}
      right={
        <TouchableOpacity
          onPress={() => onLog(habit.id, checked ? 0 : 1)}
          disabled={!interactive}
          style={[
            styles.checkCircle,
            checked
              ? { backgroundColor: accent }
              : { borderWidth: 2, borderColor: theme.backgroundSelected },
          ]}
          activeOpacity={0.7}
        >
          {checked && <Check size={16} color="#ffffff" strokeWidth={3} />}
        </TouchableOpacity>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Count habit row
// ---------------------------------------------------------------------------

interface CountHabitRowProps {
  habit: Habit;
  onLog: (habitId: number, rating: number) => void;
  isLogging: boolean;
}

export function CountHabitRow({ habit, onLog, isLogging }: CountHabitRowProps) {
  const theme = useTheme();
  const accent = accentColor(habit);
  const goal = habit.dailyGoal || 1;
  const value = habit.todayRating ?? 0;
  const interactive = !habit.frozen && !isLogging;
  const isGoalMet = value >= goal;

  const subtitle = habit.isAntiHabit
    ? value === 0 ? "Avoided" : `${value} / ${goal} slips`
    : `${value} / ${goal}`;

  return (
    <BaseRow
      habit={habit}
      accent={accent}
      subtitle={subtitle}
      inactive={value === 0}
      right={
        <View style={styles.stepper}>
          <TouchableOpacity
            onPress={() => onLog(habit.id, Math.max(0, value - 1))}
            disabled={!interactive || value === 0}
            style={[
              styles.stepBtn,
              {
                borderColor: theme.backgroundSelected,
                opacity: value === 0 ? 0.3 : 1,
              },
            ]}
            activeOpacity={0.7}
          >
            <Minus size={14} color={theme.text} strokeWidth={2} />
          </TouchableOpacity>

          <ThemedText
            type="default"
            style={[styles.countValue, isGoalMet && { color: accent }]}
          >
            {value}
          </ThemedText>

          <TouchableOpacity
            onPress={() => onLog(habit.id, value + 1)}
            disabled={!interactive}
            style={[styles.stepBtn, { borderColor: theme.backgroundSelected }]}
            activeOpacity={0.7}
          >
            <Plus size={14} color={theme.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Timed habit row
// ---------------------------------------------------------------------------

const formatMs = (ms: number) => {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface TimedHabitRowProps {
  habit: Habit;
  onLog: (habitId: number, rating: number) => void;
  isLogging: boolean;
}

export function TimedHabitRow({ habit, onLog, isLogging }: TimedHabitRowProps) {
  const theme = useTheme();
  const accent = accentColor(habit);
  const goalMs = (habit.dailyGoal || 1) * 60_000;
  const [localMs, setLocalMs] = useState(habit.todayRating ?? 0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interactive = !habit.frozen && !isLogging;

  // Sync when todayRating changes from outside (e.g. after invalidate)
  useEffect(() => {
    if (!running) setLocalMs(habit.todayRating ?? 0);
  }, [habit.todayRating, running]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setLocalMs((ms) => ms + 1000), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  function handleToggle() {
    if (running) {
      setRunning(false);
      onLog(habit.id, localMs);
    } else {
      setRunning(true);
    }
  }

  const progress = Math.min(localMs / goalMs, 1);
  const isGoalMet = progress >= 1;
  const inactive = localMs === 0 && !running;

  const subtitle = habit.isAntiHabit && localMs === 0 && !running
    ? "Avoided"
    : `${formatMs(localMs)} / ${habit.dailyGoal || 1}m`;

  return (
    <BaseRow
      habit={habit}
      accent={accent}
      subtitle={subtitle}
      inactive={inactive}
      right={
        <View style={styles.timerRight}>
          <ThemedText
            type="default"
            style={[styles.timerDisplay, isGoalMet && { color: accent }]}
          >
            {formatMs(localMs)}
          </ThemedText>
          <TouchableOpacity
            onPress={handleToggle}
            disabled={!interactive}
            style={[styles.stepBtn, { borderColor: running ? accent : theme.backgroundSelected }]}
            activeOpacity={0.7}
          >
            {running
              ? <Pause size={14} color={accent} strokeWidth={2} />
              : <Play size={14} color={localMs > 0 ? theme.text : theme.textSecondary} strokeWidth={2} />
            }
          </TouchableOpacity>
        </View>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Complex (exercise) habit row
// ---------------------------------------------------------------------------

function totalSets(dayLogs: DayLog[]): number {
  return (dayLogs[0]?.exerciseSessions ?? [])
    .flatMap((s) => s.exerciseLogs)
    .flatMap((l) => l.exercisePerformances).length;
}

interface ComplexHabitRowProps {
  habit: Habit & { dayLogs?: DayLog[] };
  onStart: (habitId: number) => void;
  onOpen: (sessionId: number) => void;
  isStarting: boolean;
}

export function ComplexHabitRow({ habit, onStart, onOpen, isStarting }: ComplexHabitRowProps) {
  const theme = useTheme();
  const accent = accentColor(habit);
  const todayLog = habit.dayLogs?.[0] ?? null;
  const hasSessions = (todayLog?.exerciseSessions?.length ?? 0) > 0;
  const firstSessionId = todayLog?.exerciseSessions[0]?.id;
  const sets = totalSets(habit.dayLogs ?? []);

  let subtitle: string;
  if (hasSessions) {
    subtitle = sets === 0 ? "Session open — add exercises to log sets" : `${sets} set${sets === 1 ? "" : "s"} logged`;
  } else {
    subtitle = "No session today";
  }

  let right: React.ReactNode;
  if (habit.frozen) {
    right = <Lock size={18} color={theme.textSecondary} strokeWidth={2} />;
  } else if (hasSessions) {
    right = (
      <TouchableOpacity
        style={[styles.stepBtn, { borderColor: theme.backgroundSelected }]}
        onPress={() => firstSessionId !== undefined && onOpen(firstSessionId)}
        activeOpacity={0.7}
      >
        <ChevronRight size={16} color={theme.textSecondary} strokeWidth={2} />
      </TouchableOpacity>
    );
  } else {
    right = (
      <TouchableOpacity
        style={[styles.startBtn, { backgroundColor: accent }]}
        onPress={() => onStart(habit.id)}
        disabled={isStarting}
        activeOpacity={0.7}
      >
        {isStarting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <ThemedText type="small" style={styles.startBtnText}>
            Start
          </ThemedText>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <BaseRow
      habit={habit}
      accent={accent}
      subtitle={subtitle}
      inactive={!hasSessions && !habit.frozen}
      right={right}
    />
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

interface HabitRowProps {
  habit: Habit & { dayLogs?: DayLog[] };
  onLog: (habitId: number, rating: number) => void;
  isLogging: boolean;
  onStartSession?: (habitId: number) => void;
  onOpenSession?: (sessionId: number) => void;
  startingSessionId?: number | null;
}

export function HabitRow({ habit, onLog, isLogging, onStartSession, onOpenSession, startingSessionId }: HabitRowProps) {
  switch (habit.type) {
    case "count":
      return <CountHabitRow habit={habit} onLog={onLog} isLogging={isLogging} />;
    case "timed":
      return <TimedHabitRow habit={habit} onLog={onLog} isLogging={isLogging} />;
    case "complex":
      return (
        <ComplexHabitRow
          habit={habit}
          onStart={onStartSession ?? (() => {})}
          onOpen={onOpenSession ?? (() => {})}
          isStarting={startingSessionId === habit.id}
        />
      );
    case "check":
    case "negative":
    default:
      return <CheckHabitRow habit={habit} onLog={onLog} isLogging={isLogging} />;
  }
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
    gap: 2,
  },
  rightSlot: {
    alignItems: "center",
    justifyContent: "center",
  },
  // Check
  checkCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  // Count stepper
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  countValue: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
  // Start button (complex habit)
  startBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 56,
    height: 32,
  },
  startBtnText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  // Timer
  timerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  timerDisplay: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    minWidth: 44,
    textAlign: "right",
  },
});
