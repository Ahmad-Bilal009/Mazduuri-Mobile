import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useAuthStore } from "@/store/authStore";
import { authApi, jobsApi } from "@/lib/api";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { signOutFromGoogle } from "@/lib/googleAuth";
import { useSavedStore } from "@/store/savedStore";
import { unregisterFromPushNotifications } from "@/lib/push";
import { LANGUAGE_META } from "@/i18n";
import type { WorkerProfile, ClientProfile, Job } from "@/types";

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user, setUser, clearUser } = useAuthStore();
  const { t, language } = useAppTranslation();

  const [profile, setProfile] = useState<WorkerProfile | ClientProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);
  const [myJobs, setMyJobs] = useState<Job[] | null>(null);

  // White status-bar icons over the green header while this tab is focused.
  // Rendered declaratively (gated on focus) so it stacks over the root
  // layout's dark StatusBar and pops back automatically on blur.
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    setProfileLoading(true);
    authApi
      .me()
      .then((data) => {
        setProfile(data.workerProfile ?? data.clientProfile ?? null);
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [isAuthenticated, user?.role]);

  // Client stats — jobs posted / open / applicants
  useEffect(() => {
    if (!isAuthenticated || user?.role !== "client") {
      setMyJobs(null);
      return;
    }
    jobsApi
      .getMy()
      .then((items) => setMyJobs(items as Job[]))
      .catch(() => setMyJobs(null));
  }, [isAuthenticated, user?.role]);

  const displayName = profile ? ("name" in profile ? profile.name : null) : null;
  const displayPic = profile?.profilePicture;
  const initials = displayName
    ? displayName[0].toUpperCase()
    : (user?.phone?.slice(-2) ?? "?");

  const noProfile = !profileLoading && profile === null;

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // ignore — clear locally regardless
    }
    // Drop the cached Google session too, otherwise the next sign-in silently
    // reuses this account instead of offering the picker.
    await signOutFromGoogle();
    // Detach this device first, or the signed-out account keeps receiving
    // its notifications.
    await unregisterFromPushNotifications();
    // Saved hearts belong to the account, not the device.
    useSavedStore.getState().clear();
    clearUser();
  }

  async function handleSwitchRole() {
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
              setProfile(null);
              // If no profile for the new role, route to create
              const hasNewProfile =
                newRole === "worker"
                  ? !!(res as unknown as { workerProfile: unknown }).workerProfile
                  : !!(res as unknown as { clientProfile: unknown }).clientProfile;
              if (!hasNewProfile) {
                setTimeout(() => {
                  router.push(
                    newRole === "worker"
                      ? "/profile/create-worker"
                      : "/profile/create-client",
                  );
                }, 100);
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

  function goToEditProfile() {
    if (noProfile) {
      router.push(
        user?.role === "worker" ? "/profile/create-worker" : "/profile/create-client",
      );
    } else {
      router.push(
        user?.role === "worker" ? "/profile/edit-worker" : "/profile/edit-client",
      );
    }
  }

  // ── Not logged in ──
  if (!isAuthenticated || !user) {
    return (
      <View style={styles.safe}>
        {focused && <StatusBar style="light" />}
        <View style={[styles.headerBar, { paddingTop: insets.top + 10 }]}>
          <View style={{ width: 40 }} />
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.notLoggedIn}>
          <MaterialCommunityIcons name="account-circle-outline" size={80} color="#9ca3af" />
          <Text style={styles.loginTitle}>Not Logged In</Text>
          <Text style={styles.loginDesc}>
            Login to view your profile, apply for jobs, and contact workers.
          </Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/auth")}>
            <Text style={styles.loginBtnText}>Login / Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const roleLabel = user.role === "worker" ? "Worker" : "Client";
  const city = profile?.city;
  const workerProfile = user.role === "worker" ? (profile as WorkerProfile | null) : null;

  // Stats — real numbers per role
  const stats =
    user.role === "worker"
      ? [
          { value: `${workerProfile?.totalJobs ?? 0}`, label: "Jobs done" },
          { value: `${workerProfile?.experience ?? 0}`, label: "Yrs exp" },
          {
            value: workerProfile && workerProfile.rating > 0 ? workerProfile.rating.toFixed(1) : "—",
            label: "Rating",
          },
        ]
      : [
          { value: `${myJobs?.length ?? 0}`, label: "Jobs posted" },
          { value: `${myJobs?.filter((j) => j.status === "open").length ?? 0}`, label: "Open" },
          {
            value: `${myJobs?.reduce((sum, j) => sum + (j._count?.applications ?? 0), 0) ?? 0}`,
            label: "Applicants",
          },
        ];

  return (
    <View style={styles.safe}>
      {focused && <StatusBar style="light" />}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {/* ── Green header ── */}
        <View style={[styles.headerCard, { paddingTop: insets.top + 10 }]}>
          <View style={styles.headerRow}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>Profile</Text>
            <TouchableOpacity
              style={styles.gearBtn}
              onPress={() => router.push("/language-select")}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="cog-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Avatar */}
          <View style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              {displayPic ? (
                <Image source={{ uri: displayPic }} style={styles.avatarImage} />
              ) : profileLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.editBadge} onPress={goToEditProfile} hitSlop={6}>
              <MaterialCommunityIcons name="pencil" size={15} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Name + role · city */}
          <View style={styles.nameRow}>
            <Text style={styles.nameText}>
              {displayName ?? (profileLoading ? "Loading…" : "No profile yet")}
            </Text>
            {user.isVerified && (
              <MaterialCommunityIcons name="check-decagram" size={19} color="#fff" style={{ marginLeft: 6 }} />
            )}
          </View>
          <Text style={styles.subtitleText}>
            {[roleLabel, city].filter(Boolean).join(" · ")}
          </Text>
        </View>

        {/* ── Stats card (overlaps header) ── */}
        <View style={styles.statsCard}>
          {stats.map((s, i) => (
            <View key={s.label} style={[styles.statCol, i > 0 && styles.statColBorder]}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* No profile banner */}
        {noProfile && (
          <TouchableOpacity style={styles.setupBanner} onPress={goToEditProfile}>
            <MaterialCommunityIcons name="account-edit" size={22} color="#16a34a" />
            <View style={{ flex: 1 }}>
              <Text style={styles.setupBannerTitle}>Set up your profile</Text>
              <Text style={styles.setupBannerDesc}>
                Add your details, selfie and ID to get started
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#16a34a" />
          </TouchableOpacity>
        )}

        {/* ── Menu ── */}
        <View style={styles.menu}>
          <MenuItem
            iconName={noProfile ? "account-plus-outline" : "account-outline"}
            label={noProfile ? "Set Up My Profile" : "Edit Profile"}
            onPress={goToEditProfile}
          />

          {user.role === "client" && (
            <MenuItem
              iconName="plus-circle-outline"
              label="Post a Job"
              onPress={() => router.push("/jobs/post")}
            />
          )}

          <MenuItem
            iconName="briefcase-outline"
            label={user.role === "client" ? "My Jobs" : "My Applications"}
            onPress={() => router.push("/my-activity")}
          />

          <MenuItem
            iconName="heart-outline"
            label="Saved Workers"
            onPress={() => router.push("/saved")}
          />

          <MenuItem
            iconName="bell-outline"
            label="Notifications"
            onPress={() => router.push("/notifications")}
          />

          <MenuItem
            iconName="web"
            label={`${t("profile.language")} — ${LANGUAGE_META[language].nativeName}`}
            onPress={() => router.push("/language-select")}
          />

          <MenuItem
            iconName="swap-horizontal"
            label={
              switchingRole
                ? "Switching…"
                : user.role === "worker"
                ? "Switch to Client Account"
                : "Switch to Worker Account"
            }
            onPress={handleSwitchRole}
            disabled={switchingRole}
          />

          <MenuItem
            iconName="help-circle-outline"
            label="Help Center"
            onPress={() =>
              Alert.alert(t("profile.help"), "For support, contact us at support@mazduuri.pk")
            }
          />

          <MenuItem
            iconName="logout"
            label="Log Out"
            onPress={handleLogout}
            danger
            last
          />
        </View>
      </ScrollView>
    </View>
  );
}

function MenuItem({
  iconName,
  label,
  onPress,
  danger,
  disabled,
  last,
}: {
  iconName: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  last?: boolean;
}) {
  const color = danger ? "#ef4444" : "#374151";
  return (
    <TouchableOpacity
      style={[styles.menuItem, last && { borderBottomWidth: 0 }, disabled && { opacity: 0.5 }]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <MaterialCommunityIcons name={iconName} size={21} color={danger ? "#ef4444" : "#4b5563"} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#c4c9d1" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },

  // Not logged in
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#16a34a",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  notLoggedIn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    marginTop: 60,
  },
  loginTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 8, marginTop: 12 },
  loginDesc: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  loginBtn: { backgroundColor: "#16a34a", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // Green header
  headerCard: {
    backgroundColor: "#16a34a",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    paddingBottom: 52,
    alignItems: "center",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  gearBtn: { width: 40, height: 40, alignItems: "flex-end", justifyContent: "center" },

  avatarWrap: { marginBottom: 14 },
  avatarRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 4,
    borderColor: "#fff",
    backgroundColor: "#15803d",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 108, height: 108, borderRadius: 54 },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 40 },
  editBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#16a34a",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  nameText: { fontSize: 23, fontWeight: "700", color: "#fff" },
  subtitleText: { fontSize: 14.5, color: "rgba(255,255,255,0.85)", marginTop: 4 },

  // Stats card
  statsCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: -38,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
  },
  statCol: { flex: 1, alignItems: "center", gap: 3 },
  statColBorder: { borderLeftWidth: 1, borderLeftColor: "#f3f4f6" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#16a34a" },
  statLabel: { fontSize: 12, color: "#6b7280" },

  // Setup banner
  setupBanner: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    borderStyle: "dashed",
  },
  setupBannerTitle: { fontSize: 14, fontWeight: "700", color: "#16a34a" },
  setupBannerDesc: { fontSize: 12, color: "#9ca3af", marginTop: 2 },

  // Menu
  menu: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
});
