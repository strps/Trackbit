import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  useAnalyticsOverview,
  useCardioSummary,
  usePersonalRecords,
  useVolumeByMuscle,
} from '@/hooks/use-analytics';

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
  const overview = useAnalyticsOverview();
  const prs = usePersonalRecords();
  const volume = useVolumeByMuscle();
  const cardio = useCardioSummary();

  const isLoading = overview.isLoading && prs.isLoading && volume.isLoading && cardio.isLoading;

  const maxMuscleVolume = volume.data?.length
    ? Math.max(...volume.data.map((m) => m.totalVolume))
    : 1;

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safe}>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} color={theme.textSecondary} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <ThemedText type="title" style={styles.pageTitle}>
              Analytics
            </ThemedText>

            {/* Overview */}
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

            {/* Personal Records */}
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

            {/* Volume by Muscle */}
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

            {/* Cardio — only shown when there is data */}
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

            <View style={styles.bottomPad} />
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  loader: { flex: 1 },
  scroll: { padding: Spacing.three },
  pageTitle: { marginBottom: Spacing.three },
  sectionHeader: { marginTop: Spacing.four, marginBottom: Spacing.two },
  empty: { marginBottom: Spacing.two },

  // Overview
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
});
