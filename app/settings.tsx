import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Constants from "expo-constants";
import * as Location from "expo-location";
import { useAuthStore } from "@/store/authStore";
import { authApi, notificationsApi, profileApi, type NotificationPreferences } from "@/lib/api";
import { clearLocalSession } from "@/lib/session";
import { LINKS } from "@/lib/links";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { LANGUAGE_META } from "@/i18n";
import { BackButton } from "@/components/BackButton";

const ALL_OFF: NotificationPreferences = {
  pushChat: false,
  pushApplications: false,
  pushReview: false,
  pushNewJobs: false,
};
const ALL_ON: NotificationPreferences = {
  pushChat: true,
  pushApplications: true,
  pushReview: true,
  pushNewJobs: true,
};

export default function SettingsScreen() {
  const router = useRouter();
  const { isAuthenticated, user, setUser } = useAuthStore();
  const { language } = useAppTranslation();

  const [notifOn, setNotifOn] = useState<boolean | null>(null);
  const [locationOn, setLocationOn] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Re-read on focus: both can change in the system settings or sub-screens.
  useFocusEffect(
    useCallback(() => {
      Location.getForegroundPermissionsAsync()
        .then((p) => setLocationOn(p.granted))
        .catch(() => {});
      if (isAuthenticated) {
        notificationsApi
          .getPreferences()
          .then(({ pushChat, pushApplications, pushReview, pushNewJobs }) =>
            setNotifOn(pushChat || pushApplications || pushReview || pushNewJobs),
          )
          .catch(() => setNotifOn(null));
      }
    }, [isAuthenticated]),
  );

  async function toggleNotifications(on: boolean) {
    const previous = notifOn;
    setNotifOn(on);
    try {
      await notificationsApi.updatePreferences(on ? ALL_ON : ALL_OFF);
    } catch {
      setNotifOn(previous);
      Alert.alert("Error", "Could not update notification settings.");
    }
  }

  async function toggleLocation(on: boolean) {
    if (on) {
      const res = await Location.requestForegroundPermissionsAsync();
      if (res.granted) {
        setLocationOn(true);
        return;
      }
      if (!res.canAskAgain) Linking.openSettings().catch(() => {});
      return;
    }
    // Apps can't revoke their own permission; send the user to system settings.
    Alert.alert(
      "Turn off location",
      "Location access is managed in your phone's settings.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open settings", onPress: () => Linking.openSettings().catch(() => {}) },
      ],
    );
  }

  function goToEditProfile() {
    if (!user) return;
    router.push(user.role === "worker" ? "/profile/edit-worker" : "/profile/edit-client");
  }

  function switchRole() {
    if (!user) return;
    const newRole = user.role === "worker" ? "client" : "worker";
    const label = newRole === "client" ? "Client" : "Worker";
    Alert.alert(
      `Switch to ${label}`,
      `You will switch your account to ${label} mode. You can switch back anytime.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Switch to ${label}`,
          onPress: async () => {
            setSwitchingRole(true);
            try {
              const res = await authApi.switchRole(newRole);
              setUser(res.user, res.token);
              const hasNewProfile =
                newRole === "worker"
                  ? !!(res as unknown as { workerProfile: unknown }).workerProfile
                  : !!(res as unknown as { clientProfile: unknown }).clientProfile;
              if (!hasNewProfile) {
                router.push(newRole === "worker" ? "/profile/create-worker" : "/profile/create-client");
              }
            } catch (e: unknown) {
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to switch role");
            } finally {
              setSwitchingRole(false);
            }
          },
        },
      ],
    );
  }

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your profile, jobs, applications, reviews and messages. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await profileApi.deleteAccount();
              await clearLocalSession();
              router.replace("/(tabs)");
              Alert.alert("Account deleted", "Your account and data have been removed.");
            } catch (e: unknown) {
              Alert.alert(
                "Could not delete account",
                e instanceof Error ? e.message : "Please try again.",
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }

  function openUrl(url: string) {
    Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open the link."));
  }

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {isAuthenticated && user && (
          <Section title="ACCOUNT">
            <Row icon="account-outline" label="Edit profile" onPress={goToEditProfile} />
            <Row
              icon="swap-horizontal"
              label={
                switchingRole
                  ? "Switching…"
                  : user.role === "worker"
                    ? "Switch to client account"
                    : "Switch to worker account"
              }
              onPress={switchRole}
              disabled={switchingRole}
              last
            />
          </Section>
        )}

        <Section title="PREFERENCES">
          <Row
            icon="web"
            label="Language"
            value={`${LANGUAGE_META[language]?.englishName ?? "English"}`}
            onPress={() => router.push("/language-select")}
          />
          {isAuthenticated && (
            <Row
              icon="bell-outline"
              label="Notifications"
              onPress={() => router.push("/notification-settings")}
              right={
                notifOn === null ? (
                  <ActivityIndicator size="small" color="#16a34a" />
                ) : (
                  <Switch
                    value={notifOn}
                    onValueChange={toggleNotifications}
                    trackColor={{ false: "#e2e8f0", true: "#22c55e" }}
                    thumbColor="#fff"
                  />
                )
              }
            />
          )}
          <Row
            icon="map-marker-outline"
            label="Location"
            last
            right={
              <Switch
                value={locationOn}
                onValueChange={toggleLocation}
                trackColor={{ false: "#e2e8f0", true: "#22c55e" }}
                thumbColor="#fff"
              />
            }
          />
        </Section>

        <Section title="PRIVACY">
          <Row icon="shield-check-outline" label="Privacy Policy" onPress={() => openUrl(LINKS.privacyPolicy)} />
          <Row icon="file-document-outline" label="Terms & Conditions" onPress={() => openUrl(LINKS.terms)} last />
        </Section>

        <Section title="SUPPORT">
          <Row icon="help-circle-outline" label="Help Center" onPress={() => openUrl(LINKS.website)} />
          <Row
            icon="headset"
            label="Contact us"
            onPress={() => openUrl(`mailto:${LINKS.supportEmail}`)}
          />
          <Row
            icon="information-outline"
            label="About Mazduuri"
            last
            onPress={() =>
              Alert.alert(
                "Mazduuri",
                `Version ${version}\n\nFind skilled workers near you, or find work in your city.`,
              )
            }
          />
        </Section>

        {isAuthenticated && (
          <Section title="DANGER ZONE">
            <Row
              icon="trash-can-outline"
              label={deleting ? "Deleting…" : "Delete account"}
              danger
              last
              disabled={deleting}
              onPress={confirmDelete}
            />
          </Section>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
  right,
  danger,
  disabled,
  last,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  last?: boolean;
}) {
  const color = danger ? "#ef4444" : "#0f172a";
  return (
    <TouchableOpacity
      style={[styles.row, !last && styles.rowBorder, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name={icon} size={21} color={danger ? "#ef4444" : "#334155"} />
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right ?? <MaterialCommunityIcons name="chevron-right" size={20} color="#94a3b8" />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: { fontSize: 19, fontWeight: "800", color: "#0f172a" },
  body: { paddingHorizontal: 16, paddingBottom: 40 },
  section: { marginTop: 18 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 14,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 14, minHeight: 52, paddingVertical: 10 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  rowValue: { fontSize: 13.5, color: "#64748b" },
});
