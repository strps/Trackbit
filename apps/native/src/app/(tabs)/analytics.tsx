import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Heatmap } from '@/components/heatmap';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  useAnalyticsOverview,
  useCardioSummary,
  usePersonalRecords,
  useVolumeByMuscle,
} from '@/hooks/use-analytics';
import { useHabits, useHabitHistory } from '@/hooks/use-habits';
import type { HabitWithHistory } from '@/lib/tracker-api';

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function offsetDate(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}

function nextDay(dateStr: string): string {
  return offsetDate(dateStr, 1);
}

function computeStreaks(map: Map<string, number>, today: string) {
  // Current streak: walk back from today
  let current = 0;
  let d = today;
  while ((map.get(d) ?? 0) > 0) {
    current++;
    d = offsetDate(d, -1);
  }

  // Best streak: sort logged days and find longest consecutive run
  const logged = [...map.entries()]
    .filter(([, v]) => v > 0)
    .map(([k]) => k)
    .sort();

  let best = 0;
  let run = 0;
  let prev = '';
  for (const day of logged) {
    if (prev && nextDay(prev) === day) {
      run++;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = day;
  }

  return { currentStreak: current, bestStreak: best };
}

function computeWeeklyBars(
  map: Map<string, number>,
  today: string,
  numWeeks = 12,
): Array<{ weekStart: string; daysCompleted: number }> {
  const d = new Date(today + 'T12:00:00Z');
  const dayOfWeek = d.getUTCDay(); // 0=Sun … 6=Sat
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const currentMonday = offsetDate(today, -daysToMonday);

  const result: Array<{ weekStart: string; daysCompleted: number }> = [];
  for (let w = numWeeks - 1; w >= 0; w--) {
    const weekStart = offsetDate(currentMonday, -w * 7);
    let daysCompleted = 0;
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      if ((map.get(offsetDate(weekStart, dayOffset)) ?? 0) > 0) daysCompleted++;
    }
    result.push({ weekStart, daysCompleted });
  }
  return result;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function SectionHeader({ title }: { title: string }) {
  return (
    <ThemedText type="subtitle" style={styles.sectionHeader}>
      {title}
    </ThemedText>
  );
}

export default function AnalyticsScreen() {
  const theme = useTheme();
  const today = toDateStr(new Date());
  const startDate = offsetDate(today, -364);

  const [activeSection, setActiveSection] = useState<'habits' | 'exercises'>('habits');
  const [selectedHabitId, setSelectedHabitId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const habits = useHabits();
  const history = useHabitHistory(startDate, today);
  const overview = useAnalyticsOverview();
  const prs = usePersonalRecords();
  const volume = useVolumeByMuscle();
  const cardio = useCardioSummary();

  const isWorkoutLoading = overview.isLoading && prs.isLoading && volume.isLoading && cardio.isLoading;

  // Auto-select first non-frozen habit
  const habitsData = habits.data;
  useEffect(() => {
    if (selectedHabitId === null && habitsData?.length) {
      const first = habitsData.find((h) => !h.frozen) ?? habitsData[0];
      setSelectedHabitId(first.id);
    }
  }, [habitsData, selectedHabitId]);

  const selectedHabitData: HabitWithHistory | null =
    history.data?.find((h) => h.id === selectedHabitId) ?? null;
  const selectedHabitMeta = habitsData?.find((h) => h.id === selectedHabitId) ?? null;

  const dayLogMap = useMemo<Map<string, number>>(() => {
    if (!selectedHabitData) return new Map();
    return new Map(
      selectedHabitData.dayLogs.map((d) => [
        d.localDay,
        selectedHabitData.type === 'complex'
          ? d.exerciseSessions.length > 0 ? 1 : 0
          : (d.rating ?? 0),
      ]),
    );
  }, [selectedHabitData]);

  const getRating = (date: string) => dayLogMap.get(date) ?? 0;

  const { currentStreak, bestStreak } = useMemo(
    () => computeStreaks(dayLogMap, today),
    [dayLogMap, today],
  );

  const weeklyBars = useMemo(
    () => computeWeeklyBars(dayLogMap, today),
    [dayLogMap, today],
  );

  const maxMuscleVolume = volume.data?.length
    ? Math.max(...volume.data.map((m) => m.totalVolume))
    : 1;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <ThemedText type="title" style={styles.pageTitle}>
            Analytics
          </ThemedText>

          {/* Section toggle */}
          <View style={styles.sectionToggle}>
            {(['habits', 'exercises'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setActiveSection(s)}
                style={[
                  styles.sectionToggleBtn,
                  activeSection === s && { backgroundColor: theme.backgroundSelected },
                ]}
              >
                <ThemedText style={styles.sectionToggleText}>
                  {s === 'habits' ? 'Habits' : 'Exercises'}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Habits ── */}
          {activeSection === 'habits' && (
            <>
              {habits.isLoading ? (
                <ActivityIndicator color={theme.textSecondary} style={styles.miniLoader} />
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.selectorScroll}
                  style={styles.selectorContainer}
                >
                  {habitsData?.map((h) => (
                    <TouchableOpacity
                      key={h.id}
                      onPress={() => setSelectedHabitId(h.id)}
                      style={[
                        styles.habitPill,
                        h.id === selectedHabitId && { backgroundColor: theme.backgroundSelected },
                      ]}
                    >
                      <ThemedText style={styles.habitPillText} numberOfLines={1}>
                        {h.icon} {h.name}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {selectedHabitMeta && !history.isLoading ? (
                <ThemedView type="backgroundElement" style={styles.heatmapCard}>
                  <Heatmap
                    getRating={getRating}
                    maxValue={selectedHabitMeta.dailyGoal || 1}
                    colorStops={selectedHabitMeta.colorStops}
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    today={today}
                  />
                </ThemedView>
              ) : (
                <ActivityIndicator color={theme.textSecondary} style={styles.miniLoader} />
              )}

              {selectedHabitMeta && (
                <View style={styles.statRow}>
                  <ThemedView type="backgroundElement" style={styles.statCard}>
                    <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                      Current Streak
                    </ThemedText>
                    <ThemedText type="subtitle">{currentStreak}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                      {currentStreak === 1 ? 'day' : 'days'}
                    </ThemedText>
                  </ThemedView>
                  <ThemedView type="backgroundElement" style={styles.statCard}>
                    <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                      Best Streak
                    </ThemedText>
                    <ThemedText type="subtitle">{bestStreak}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                      {bestStreak === 1 ? 'day' : 'days'}
                    </ThemedText>
                  </ThemedView>
                </View>
              )}

              {selectedHabitMeta && (
                <ThemedView type="backgroundElement" style={styles.weeklyChartCard}>
                  <ThemedText themeColor="textSecondary" style={styles.weeklyChartTitle}>
                    Weekly Completion
                  </ThemedText>
                  <View style={styles.weeklyChartBars}>
                    {weeklyBars.map((bar, index) => (
                      <View key={bar.weekStart} style={styles.weeklyBarCol}>
                        <View style={[styles.weeklyBarTrack, { backgroundColor: theme.backgroundElement }]}>
                          <View
                            style={[
                              styles.weeklyBarFill,
                              {
                                height: `${Math.round((bar.daysCompleted / 7) * 100)}%`,
                                backgroundColor: theme.backgroundSelected,
                              },
                            ]}
                          />
                        </View>
                        <ThemedText themeColor="textSecondary" style={styles.weeklyBarLabel}>
                          {index % 4 === 0 ? bar.weekStart.slice(5).replace('-', '/') : ''}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                </ThemedView>
              )}
            </>
          )}

          {/* ── Exercises ── */}
          {activeSection === 'exercises' && (
            <>
              {isWorkoutLoading ? (
                <ActivityIndicator style={styles.loader} color={theme.textSecondary} />
              ) : (
                <>
                  <SectionHeader title="Overview" />
                  {overview.data ? (
                    <>
                      <View style={styles.statRow}>
                        <ThemedView type="backgroundElement" style={styles.statCard}>
                          <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                            Sessions
                          </ThemedText>
                          <ThemedText type="subtitle">{overview.data.totalSessions}</ThemedText>
                        </ThemedView>
                        <ThemedView type="backgroundElement" style={styles.statCard}>
                          <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                            Volume (kg)
                          </ThemedText>
                          <ThemedText type="subtitle">
                            {Math.round(overview.data.totalStrengthVolume).toLocaleString()}
                          </ThemedText>
                        </ThemedView>
                      </View>
                      <View style={styles.categoryRow}>
                        {(
                          [
                            ['Strength', overview.data.sessionsByCategory.strength],
                            ['Cardio', overview.data.sessionsByCategory.cardio],
                            ['Flexibility', overview.data.sessionsByCategory.flexibility],
                          ] as const
                        ).map(([label, count]) => (
                          <ThemedView key={label} type="backgroundElement" style={styles.categoryPill}>
                            <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                              {label}
                            </ThemedText>
                            <ThemedText type="smallBold">{count}</ThemedText>
                          </ThemedView>
                        ))}
                      </View>
                    </>
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.empty}>
                      No session data yet.
                    </ThemedText>
                  )}

                  <SectionHeader title="Personal Records" />
                  {prs.data && prs.data.length > 0 ? (
                    prs.data.map((pr, i) => (
                      <ThemedView key={i} type="backgroundElement" style={styles.prRow}>
                        <View style={styles.prLeft}>
                          <ThemedText type="default" style={styles.prName}>
                            {pr.exerciseName}
                          </ThemedText>
                          <ThemedText themeColor="textSecondary" style={styles.prSub}>
                            {pr.weight} kg × {pr.reps ?? '—'} reps · 1RM ≈ {Math.round(pr.estimated1RM)} kg
                          </ThemedText>
                        </View>
                        <ThemedText themeColor="textSecondary" style={styles.prDate}>
                          {formatDate(pr.date)}
                        </ThemedText>
                      </ThemedView>
                    ))
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.empty}>
                      No personal records yet.
                    </ThemedText>
                  )}

                  <SectionHeader title="Volume by Muscle" />
                  {volume.data && volume.data.length > 0 ? (
                    volume.data.map((m) => (
                      <View key={m.muscleGroup} style={styles.muscleRow}>
                        <ThemedText style={styles.muscleName}>{m.muscleGroup}</ThemedText>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                width: `${Math.round((m.totalVolume / maxMuscleVolume) * 100)}%`,
                                backgroundColor: theme.backgroundSelected,
                              },
                            ]}
                          />
                        </View>
                        <ThemedText themeColor="textSecondary" style={styles.muscleValue}>
                          {Math.round(m.totalVolume).toLocaleString()}
                        </ThemedText>
                      </View>
                    ))
                  ) : (
                    <ThemedText themeColor="textSecondary" style={styles.empty}>
                      No muscle volume data yet.
                    </ThemedText>
                  )}

                  {cardio.data && cardio.data.totalDurationSeconds > 0 && (
                    <>
                      <SectionHeader title="Cardio" />
                      <View style={styles.statRow}>
                        <ThemedView type="backgroundElement" style={styles.statCard}>
                          <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                            Distance
                          </ThemedText>
                          <ThemedText type="subtitle">
                            {cardio.data.totalDistance.toFixed(1)} km
                          </ThemedText>
                        </ThemedView>
                        <ThemedView type="backgroundElement" style={styles.statCard}>
                          <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                            Duration
                          </ThemedText>
                          <ThemedText type="subtitle">
                            {formatDuration(cardio.data.totalDurationSeconds)}
                          </ThemedText>
                        </ThemedView>
                        <ThemedView type="backgroundElement" style={styles.statCard}>
                          <ThemedText themeColor="textSecondary" style={styles.statLabel}>
                            Avg Pace
                          </ThemedText>
                          <ThemedText type="subtitle">
                            {cardio.data.averagePace.toFixed(1)}/h
                          </ThemedText>
                        </ThemedView>
                      </View>
                    </>
                  )}
                </>
              )}
            </>
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  loader: { flex: 1 },
  miniLoader: { marginVertical: Spacing.two },
  scroll: { padding: Spacing.three },
  pageTitle: { marginBottom: Spacing.three },
  sectionToggle: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  sectionToggleBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: Colors.dark.backgroundElement,
  },
  sectionToggleText: { fontSize: 14 },
  sectionHeader: { marginTop: Spacing.four, marginBottom: Spacing.two },
  empty: { marginBottom: Spacing.two },

  // Habit selector
  selectorContainer: { marginBottom: Spacing.two },
  selectorScroll: { gap: Spacing.two, paddingVertical: Spacing.one },
  habitPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: 20,
    backgroundColor: Colors.dark.backgroundElement,
  },
  habitPillText: { fontSize: 13 },

  // Heatmap card
  heatmapCard: {
    borderRadius: 10,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    marginBottom: Spacing.two,
  },

  // Stats / streaks
  statRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  statCard: { flex: 1, borderRadius: 10, padding: Spacing.three, gap: Spacing.half },
  statLabel: { fontSize: 12 },
  categoryRow: { flexDirection: 'row', gap: Spacing.two },
  categoryPill: { flex: 1, borderRadius: 10, padding: Spacing.two, gap: Spacing.half, alignItems: 'center' },

  // PRs
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  prLeft: { flex: 1, gap: Spacing.half },
  prName: { fontSize: 14 },
  prSub: { fontSize: 12 },
  prDate: { fontSize: 12 },

  // Muscle volume
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  muscleName: { width: 96, fontSize: 13 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.dark.backgroundElement,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4 },
  muscleValue: { width: 52, fontSize: 12, textAlign: 'right' },

  bottomPad: { height: Spacing.six },

  // Weekly completion bar chart
  weeklyChartCard: {
    borderRadius: 10,
    padding: Spacing.three,
    marginBottom: Spacing.two,
  },
  weeklyChartTitle: {
    fontSize: 12,
    marginBottom: Spacing.two,
  },
  weeklyChartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.half,
    height: 80,
  },
  weeklyBarCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
  },
  weeklyBarTrack: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    borderRadius: 2,
    overflow: 'hidden',
  },
  weeklyBarFill: {
    width: '100%',
    borderRadius: 2,
  },
  weeklyBarLabel: {
    fontSize: 9,
    marginTop: Spacing.half,
    textAlign: 'center',
  },
});
