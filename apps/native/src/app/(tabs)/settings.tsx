import { StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { Spacing } from "@/constants/theme";

function SettingsRow({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <ThemedText type="default">{label}</ThemedText>
      <ThemedText themeColor="textSecondary" style={styles.chevron}>›</ThemedText>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.heading}>Settings</ThemedText>
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            HABITS
          </ThemedText>
          <SettingsRow
            label="Manage habits"
            onPress={() => router.push("/habits/manage" as never)}
          />
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.three },
  heading: { marginBottom: Spacing.four },
  section: { gap: Spacing.two },
  sectionLabel: { marginBottom: Spacing.one, marginLeft: Spacing.two },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  chevron: { fontSize: 20, fontWeight: "300" },
});
