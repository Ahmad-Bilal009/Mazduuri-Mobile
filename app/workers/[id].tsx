import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { workersApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { WorkerProfile } from "@/types";
import {
  formatCurrency,
  formatPhone,
  SKILL_LABELS,
  SKILL_ICONS,
} from "@/lib/utils";

export default function WorkerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user?.role === "worker") {
      router.replace("/(tabs)");
      return;
    }
    workersApi
      .get(id)
      .then(setWorker)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (error || !worker) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>😕</Text>
        <Text style={styles.errorTitle}>Worker not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <View style={styles.card}>
          <View
            style={[styles.avatar, { backgroundColor: getColor(worker.name) }]}
          >
            {worker.profilePicture ? (
              <Image source={{ uri: worker.profilePicture }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>
                {worker.name[0]?.toUpperCase()}
              </Text>
            )}
          </View>
          <Text style={styles.name}>{worker.name}</Text>
          {worker.city && (
            <Text style={styles.location}>📍 {worker.city}</Text>
          )}
          <View style={styles.badges}>
            <View
              style={[
                styles.badge,
                worker.availability ? styles.badgeGreen : styles.badgeGray,
              ]}
            >
              <Text
                style={{
                  color: worker.availability ? "#16a34a" : "#6b7280",
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {worker.availability ? "✓ Available" : "Busy"}
              </Text>
            </View>
            {worker.experience > 0 && (
              <View style={styles.badge}>
                <Text style={{ color: "#374151", fontSize: 12 }}>
                  {worker.experience} yrs exp
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Wage */}
        <View style={styles.wageCard}>
          <Text style={styles.wageLabel}>Daily Rate</Text>
          <Text style={styles.wageValue}>
            {formatCurrency(worker.dailyWage)}
          </Text>
          <Text style={styles.wagePer}>per day</Text>
        </View>

        {/* Bio */}
        {worker.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{worker.bio}</Text>
          </View>
        )}

        {/* Skills */}
        {worker.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.skillList}>
              {worker.skills.map((skill) => (
                <View key={skill} style={styles.skillTag}>
                  <Text style={styles.skillText}>
                    {SKILL_ICONS[skill]} {SKILL_LABELS[skill]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          {isAuthenticated ? (
            <View style={styles.contactBtns}>
              {worker.user?.phone && (
                <TouchableOpacity
                  style={styles.callBtn}
                  onPress={() => Linking.openURL(`tel:${worker.user!.phone}`)}
                >
                  <Text style={styles.callBtnText}>
                    📞 Call {formatPhone(worker.user!.phone)}
                  </Text>
                </TouchableOpacity>
              )}
              {worker.user?.phone && (
                <TouchableOpacity
                  style={styles.waBtn}
                  onPress={() =>
                    Linking.openURL(
                      `https://wa.me/${worker.user!.phone.replace(/\D/g, "")}`,
                    )
                  }
                >
                  <Text style={styles.waBtnText}>💬 WhatsApp</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.loginPrompt}>
              <Text style={styles.lockEmoji}>🔒</Text>
              <Text style={styles.loginPromptText}>
                Login to see contact details
              </Text>
              <TouchableOpacity
                style={styles.loginBtn}
                onPress={() => router.push("/auth")}
              >
                <Text style={styles.loginBtnText}>Login to Contact</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function getColor(name: string): string {
  const colors = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
  return colors[name.charCodeAt(0) % colors.length];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
    padding: 24,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  backBtnText: { color: "#fff", fontWeight: "600" },
  card: {
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarImage: { width: 72, height: 72, borderRadius: 36 },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 28 },
  name: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 4 },
  location: { fontSize: 14, color: "#6b7280", marginBottom: 10 },
  badges: { flexDirection: "row", gap: 8 },
  badge: {
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeGreen: { backgroundColor: "#f0fdf4" },
  badgeGray: { backgroundColor: "#f3f4f6" },
  wageCard: {
    backgroundColor: "#f0fdf4",
    margin: 12,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  wageLabel: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "600",
    marginBottom: 2,
  },
  wageValue: { fontSize: 28, fontWeight: "700", color: "#15803d" },
  wagePer: { fontSize: 12, color: "#16a34a" },
  section: {
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  bio: { fontSize: 14, color: "#374151", lineHeight: 20 },
  skillList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  skillTag: {
    backgroundColor: "#f0fdf4",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  skillText: { fontSize: 12, color: "#16a34a", fontWeight: "500" },
  contactBtns: { gap: 10 },
  callBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  callBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  waBtn: {
    backgroundColor: "#25D366",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  waBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  loginPrompt: { alignItems: "center", padding: 12 },
  lockEmoji: { fontSize: 32, marginBottom: 8 },
  loginPromptText: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 12,
    textAlign: "center",
  },
  loginBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  loginBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
