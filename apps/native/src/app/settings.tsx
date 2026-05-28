import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Application from "expo-application";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/context/auth-context";
import { apiFetch, ApiError } from "@/lib/api";
import { Spacing } from "@/constants/theme";

const LOCALES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

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
  const { user, token, signOut, updateUser } = useAuth();
  const router = useRouter();
  const theme = useTheme();

  const [localePicking, setLocalePicking] = useState(false);
  const [timezonePicking, setTimezonePicking] = useState(false);
  const [tzSearch, setTzSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const allTimezones = Intl.supportedValuesOf("timeZone");
  const filteredTimezones = tzSearch
    ? allTimezones.filter(tz => tz.toLowerCase().includes(tzSearch.toLowerCase()))
    : allTimezones;

  const currentLocaleLabel = LOCALES.find(l => l.code === user?.locale)?.label ?? user?.locale ?? "Default";

  async function patchPreference(prefs: { locale?: string; timezone?: string }) {
    if (saving) return;
    setSaving(true);
    try {
      await apiFetch("/api/me/preferences", { method: "PATCH", body: prefs, token: token! });
      updateUser(prefs);
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

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
          <SettingsRow
            label="Locale"
            value={currentLocaleLabel}
            onPress={() => setLocalePicking(true)}
          />
          <SettingsRow
            label="Timezone"
            value={user?.timezone ?? "Default"}
            onPress={() => setTimezonePicking(true)}
          />
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionLabel}>
            ABOUT
          </ThemedText>
          <SettingsRow
            label="Version"
            value={`${Application.nativeApplicationVersion ?? "—"} (${Application.nativeBuildVersion ?? "—"})`}
          />
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

      {/* Locale picker modal */}
      <Modal visible={localePicking} transparent animationType="fade" onRequestClose={() => setLocalePicking(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setLocalePicking(false)}>
          <Pressable style={[styles.localeCard, { backgroundColor: theme.backgroundElement }]} onPress={() => {}}>
            <ThemedText type="default" style={[styles.modalTitle, { fontWeight: "600" }]}>Select Language</ThemedText>
            {LOCALES.map(locale => (
              <TouchableOpacity
                key={locale.code}
                style={[
                  styles.localeRow,
                  user?.locale === locale.code && { backgroundColor: theme.backgroundSelected },
                ]}
                onPress={() => { patchPreference({ locale: locale.code }); setLocalePicking(false); }}
                activeOpacity={0.7}
              >
                <ThemedText type="default">{locale.label}</ThemedText>
                {user?.locale === locale.code && (
                  <ThemedText themeColor="textSecondary">✓</ThemedText>
                )}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Timezone picker modal */}
      <Modal visible={timezonePicking} animationType="slide" onRequestClose={() => { setTimezonePicking(false); setTzSearch(""); }}>
        <SafeAreaView style={[styles.tzModal, { backgroundColor: theme.background }]}>
          <View style={[styles.tzHeader, { borderBottomColor: theme.backgroundElement }]}>
            <ThemedText type="default" style={{ fontWeight: "600" }}>Select Timezone</ThemedText>
            <TouchableOpacity onPress={() => { setTimezonePicking(false); setTzSearch(""); }} hitSlop={8}>
              <ThemedText themeColor="textSecondary" style={styles.tzClose}>✕</ThemedText>
            </TouchableOpacity>
          </View>
          <View style={[styles.tzSearchWrap, { backgroundColor: theme.backgroundElement }]}>
            <TextInput
              style={[styles.tzSearch, { color: theme.text }]}
              placeholder="Search…"
              placeholderTextColor={theme.textSecondary}
              value={tzSearch}
              onChangeText={setTzSearch}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
          <FlatList
            data={filteredTimezones}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.tzRow, { borderBottomColor: theme.backgroundElement }]}
                onPress={() => { patchPreference({ timezone: item }); setTimezonePicking(false); setTzSearch(""); }}
                activeOpacity={0.7}
              >
                <ThemedText type="default">{item}</ThemedText>
                {user?.timezone === item && (
                  <ThemedText themeColor="textSecondary">✓</ThemedText>
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
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
  // Locale modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  localeCard: {
    borderRadius: 16,
    paddingVertical: Spacing.two,
    width: 260,
    overflow: "hidden",
  },
  modalTitle: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  localeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 8,
    marginHorizontal: Spacing.one,
  },
  // Timezone modal
  tzModal: { flex: 1 },
  tzHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tzClose: { fontSize: 18 },
  tzSearchWrap: {
    marginHorizontal: Spacing.three,
    marginVertical: Spacing.two,
    borderRadius: 10,
    paddingHorizontal: Spacing.two,
  },
  tzSearch: {
    height: 40,
    fontSize: 15,
  },
  tzRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
