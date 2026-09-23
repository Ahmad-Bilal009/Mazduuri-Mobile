import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  TouchableOpacity,
  Linking,
  Platform,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import * as Notifications from "expo-notifications";
import { SafeAreaView } from "react-native-safe-area-context";
import { notificationsApi, type NotificationPreferences } from "@/lib/api";
import { registerForPushNotifications } from "@/lib/push";
import { BackButton } from "@/components/BackButton";

type PrefKey = keyof NotificationPreferences;

const ROWS: { key: PrefKey; icon: string; label: string; description: string }[] = [
  {
    key: "pushChat",
    icon: "chat-outline",
    label: "Messages",
    description: "When someone sends you a message",
  },
  {
    key: "pushApplications",
    icon: "briefcase-outline",
    label: "Job activity",
    description: "Applications on your jobs, and decisions on yours",
  },
  {
    key: "pushReview",
    icon: "shield-check-outline",
    label: "Profile review",
    description: "When your profile is approved or needs changes",
  },
  {
    key: "pushNewJobs",
    icon: "bell-ring-outline",
    label: "New jobs",
    description: "Jobs matching your skills in your city",
  },
];

export default function NotificationSettingsScreen() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [serverEnabled, setServerEnabled] = useState(true);
  const [osGranted, setOsGranted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, perms] = await Promise.all([
        notificationsApi.getPreferences(),
        Notifications.getPermissionsAsync(),
      ]);
      const { pushEnabled, ...rest } = data;
      setPrefs(rest);
      setServerEnabled(pushEnabled);
      setOsGranted(perms.granted);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(key: PrefKey, value: boolean) {
    if (!prefs) return;
    const previous = prefs;
    // Optimistic: a switch that lags behind the finger feels broken.
    setPrefs({ ...prefs, [key]: value });
    try {
      await notificationsApi.updatePreferences({ [key]: value });
    } catch {
      setPrefs(previous);
    }
  }

  async function handleEnablePermission() {
    const outcome = await registerForPushNotifications();
    if (outcome === "granted") {
      setOsGranted(true);
    } else {
      // Android 13+ ignores a repeat request once denied, so the only route
      // left is system settings.
      Linking.openSettings().catch(() => {});
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          {Platform.OS !== "android" && (
            <View style={styles.notice}>
              <MaterialCommunityIcons name="information-outline" size={18} color="#92400e" />
              <Text style={styles.noticeText}>
                Push notifications are currently available on Android only.
              </Text>
            </View>
          )}

          {!osGranted && Platform.OS === "android" && (
            <TouchableOpacity style={styles.notice} onPress={handleEnablePermission}>
              <MaterialCommunityIcons name="bell-off-outline" size={18} color="#92400e" />
              <Text style={styles.noticeText}>
                Notifications are turned off for Mazduuri. Tap to enable them.
              </Text>
            </TouchableOpacity>
          )}

          {!serverEnabled && (
            <View style={styles.notice}>
              <MaterialCommunityIcons name="alert-outline" size={18} color="#92400e" />
              <Text style={styles.noticeText}>
                Push delivery isn&apos;t configured on the server yet. Your choices are
                saved and will apply once it is.
              </Text>
            </View>
          )}

          <View style={styles.card}>
            {ROWS.map((row, i) => (
              <View
                key={row.key}
                style={[styles.row, i === ROWS.length - 1 && { borderBottomWidth: 0 }]}
              >
                <MaterialCommunityIcons name={row.icon} size={22} color="#4b5563" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowDesc}>{row.description}</Text>
                </View>
                <Switch
                  value={prefs?.[row.key] ?? true}
                  onValueChange={(v) => toggle(row.key, v)}
                  trackColor={{ false: "#e5e7eb", true: "#bbf7d0" }}
                  thumbColor={prefs?.[row.key] ? "#16a34a" : "#f3f4f6"}
                />
              </View>
            ))}
          </View>

          <Text style={styles.footnote}>
            Turning a category off stops those notifications for every device signed
            in to your account.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  body: { padding: 16, paddingBottom: 32 },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  noticeText: { flex: 1, fontSize: 12.5, color: "#92400e", lineHeight: 18 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  rowLabel: { fontSize: 15, fontWeight: "600", color: "#111827" },
  rowDesc: { fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 16 },
  footnote: {
    fontSize: 12,
    color: "#9ca3af",
    lineHeight: 17,
    marginTop: 14,
    paddingHorizontal: 4,
  },
  errorText: { color: "#ef4444", fontSize: 14, textAlign: "center" },
  retryBtn: {
    marginTop: 14,
    backgroundColor: "#16a34a",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "600" },
});
