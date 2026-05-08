import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "@/store/authStore";
import { authApi } from "@/lib/api";
import { formatPhone } from "@/lib/utils";
import { useAppTranslation } from "@/hooks/useAppTranslation";
import { LANGUAGE_META } from "@/i18n";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function ProfileScreen() {
  const router = useRouter();
  const { isAuthenticated, user, clearUser } = useAuthStore();
  const { t, language } = useAppTranslation();

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // ignore — clear locally regardless
    }
    clearUser();
  }

  if (!isAuthenticated || !user) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.notLoggedIn}>
          <Text style={{ fontSize: 50, marginBottom: 16 }}>👤</Text>
          <Text style={styles.loginTitle}>Not Logged In</Text>
          <Text style={styles.loginDesc}>
            Login to view your profile, apply for jobs, and contact workers.
          </Text>
          <TouchableOpacity
            style={styles.loginBtn}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.loginBtnText}>Login / Sign Up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <LanguageSwitcher />
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={[styles.avatar, { backgroundColor: "#16a34a" }]}>
            <Text style={styles.avatarText}>{user.phone.slice(-2)}</Text>
          </View>
          <View>
            <Text style={styles.phone}>{formatPhone(user.phone)}</Text>
            <View style={styles.roleRow}>
              <View
                style={[
                  styles.roleBadge,
                  user.role === "worker"
                    ? styles.workerBadge
                    : styles.clientBadge,
                ]}
              >
                <Text
                  style={[
                    styles.roleText,
                    { color: user.role === "worker" ? "#16a34a" : "#9333ea" },
                  ]}
                >
                  {user.role === "worker" ? "👷 Worker" : "🏢 Client"}
                </Text>
              </View>
              {user.isVerified && (
                <View style={[styles.roleBadge, { backgroundColor: "#f0fdf4" }]}>
                  <Text
                    style={{ color: "#16a34a", fontSize: 11, fontWeight: "600" }}
                  >
                    ✓ Verified
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Menu */}
        <View style={styles.menu}>
          {user.role === "worker" && (
            <MenuItem
              emoji="📝"
              label="Edit My Profile"
              onPress={() => router.push("/profile/edit-worker")}
            />
          )}
          {user.role === "client" && (
            <MenuItem
              emoji="📝"
              label="Edit My Profile"
              onPress={() => router.push("/profile/edit-client")}
            />
          )}
          {user.role === "client" && (
            <MenuItem
              emoji="➕"
              label="Post a Job"
              onPress={() => router.push("/jobs/post")}
            />
          )}
          <MenuItem
            emoji="💼"
            label="My Jobs / Applications"
            onPress={() => router.push("/my-activity")}
          />
          <MenuItem
            emoji="🌐"
            label={`${t("profile.language")} — ${LANGUAGE_META[language].nativeName}`}
            onPress={() => router.push("/language-select")}
          />
          <MenuItem
            emoji="❓"
            label={t("profile.help")}
            onPress={() =>
              Alert.alert(
                t("profile.help"),
                "For support, contact us at support@mazduuri.pk",
              )
            }
          />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  emoji,
  label,
  onPress,
}: {
  emoji: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Text style={styles.menuIcon}>{emoji}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={{ color: "#9ca3af" }}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  scroll: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  notLoggedIn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    marginTop: 80,
  },
  loginTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  loginDesc: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  loginBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  profileCard: {
    backgroundColor: "#fff",
    margin: 16,
    borderRadius: 20,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 20 },
  phone: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 6 },
  roleRow: { flexDirection: "row", gap: 6 },
  roleBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  workerBadge: { backgroundColor: "#f0fdf4" },
  clientBadge: { backgroundColor: "#faf5ff" },
  roleText: { fontSize: 11, fontWeight: "600" },
  menu: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  menuIcon: { fontSize: 18 },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: "500", color: "#374151" },
  logoutBtn: {
    margin: 16,
    backgroundColor: "#fef2f2",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  logoutText: { color: "#ef4444", fontWeight: "600", fontSize: 15 },
});