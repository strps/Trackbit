import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/context/auth-context";
import { Spacing } from "@/constants/theme";

function SettingsRow({ label, value, onPress }: { label: string; value?: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <ThemedText type="default">{label}</ThemedText>
      {value ? (
        <ThemedText themeColor="textSecondary">{value}</ThemedText>
      ) : onPress ? (
        <ThemedText themeColor="textSecondary" style={styles.chevron}>›</ThemedText>
      ) : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            PROFILE
          </ThemedText>
          <SettingsRow label="Name" value={user?.name ?? "—"} />
          <SettingsRow label="Email" value={user?.email ?? "—"} />
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            PREFERENCES
          </ThemedText>
          <SettingsRow label="Locale" value={user?.locale ?? "Default"} onPress={() => {}} />
          <SettingsRow label="Timezone" value={user?.timezone ?? "Default"} onPress={() => {}} />
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.row, { backgroundColor: theme.backgroundElement }]}
            onPress={async () => { await signOut(); router.replace("/auth/sign-in" as never); }}
            activeOpacity={0.7}
          >
            <ThemedText style={{ color: "#E5484D" }}>Sign out</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: Spacing.three },
  section: { gap: Spacing.two, marginBottom: Spacing.four },
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
