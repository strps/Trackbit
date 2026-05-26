import { ActivityIndicator, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Dumbbell, Lock, ChevronRight } from 'lucide-react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { HabitIcon, accentColor } from '@/components/habit-row';
import { useTodayHistory, useStartExerciseSession } from '@/hooks/use-tracker';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import type { HabitWithHistory } from '@/lib/tracker-api';

function formatToday(): string {
  return `Today, ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
}

function totalSetsForHabit(habit: HabitWithHistory): number {
  const log = habit.dayLogs[0];
  if (!log) return 0;
  return log.exerciseSessions
    .flatMap((s) => s.exerciseLogs)
    .flatMap((l) => l.exercisePerformances).length;
}

// --- Empty state ---

function EmptyState() {
  const theme = useTheme();
  return (
    <View style={styles.emptyState}>
      <Dumbbell size={40} color={theme.textSecondary} strokeWidth={1.5} />
      <ThemedText type="subtitle" style={styles.emptyTitle}>
        No exercise habits
      </ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.emptyBody}>
        Create a habit with type "complex" to track your workouts here.
      </ThemedText>
    </View>
  );
}

// --- Exercise habit card ---

interface ExerciseHabitCardProps {
  habit: HabitWithHistory;
  onStart: (habitId: number) => void;
  onOpen: (sessionId: number) => void;
  isStarting: boolean;
}

function ExerciseHabitCard({ habit, onStart, onOpen, isStarting }: ExerciseHabitCardProps) {
  const theme = useTheme();
  const accent = accentColor(habit);
  const todayLog = habit.dayLogs[0] ?? null;
  const hasSessions = (todayLog?.exerciseSessions?.length ?? 0) > 0;
  const firstSessionId = todayLog?.exerciseSessions[0]?.id;
  const sets = totalSetsForHabit(habit);

  let subtitle: string;
  if (hasSessions) {
    subtitle = sets === 0 ? 'Session open — add exercises to log sets' : `${sets} set${sets === 1 ? '' : 's'} logged`;
  } else {
    subtitle = 'No session today';
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.backgroundElement, opacity: hasSessions || habit.frozen ? 1 : 0.7 },
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

      <View style={styles.cardBody}>
        <ThemedText
          type="default"
          themeColor={habit.frozen ? 'textSecondary' : 'text'}
          numberOfLines={1}
        >
          {habit.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {subtitle}
        </ThemedText>
      </View>

      {habit.frozen ? (
        <Lock size={18} color={theme.textSecondary} strokeWidth={2} />
      ) : hasSessions ? (
        <TouchableOpacity
          style={[styles.actionBtn, { borderColor: theme.backgroundSelected }]}
          onPress={() => firstSessionId !== undefined && onOpen(firstSessionId)}
          activeOpacity={0.7}
        >
          <ChevronRight size={16} color={theme.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      ) : (
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
      )}
    </View>
  );
}

// --- Screen ---

export default function LogScreen() {
  const { data: history = [], isLoading, isFetching, refetch } = useTodayHistory();
  const { mutate: startSession, isPending: isStarting, variables: startingId } =
    useStartExerciseSession();

  const exerciseHabits = history.filter((h) => h.type === 'complex');

  if (isLoading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="subtitle" style={styles.dateHeader}>
        {formatToday()}
      </ThemedText>
      <FlatList
        data={exerciseHabits}
        keyExtractor={(h) => String(h.id)}
        contentContainerStyle={styles.list}
        refreshing={isFetching && !isLoading}
        onRefresh={refetch}
        renderItem={({ item }) => (
          <ExerciseHabitCard
            habit={item}
            onStart={(habitId) =>
              startSession(habitId, {
                onSuccess: ({ session }) => router.push(`/session/${session.id}`),
              })
            }
            onOpen={(sessionId) => router.push(`/session/${sessionId}`)}
            isStarting={isStarting && startingId === item.id}
          />
        )}
        ListEmptyComponent={<EmptyState />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    fontSize: 24,
    lineHeight: 32,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    flexGrow: 1,
  },
  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBtn: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two + Spacing.one,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    height: 32,
  },
  startBtnText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
    paddingTop: Spacing.six,
  },
  emptyTitle: {
    marginTop: Spacing.two,
  },
  emptyBody: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
