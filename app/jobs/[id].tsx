import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { jobsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { Job } from "@/types";
import {
  formatCurrency,
  DURATION_LABELS,
  SKILL_LABELS,
  SKILL_ICONS,
  timeAgo,
} from "@/lib/utils";

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isAuthenticated, user, token } = useAuthStore();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    jobsApi
      .get(id)
      .then(setJob)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleApply() {
    if (!isAuthenticated || !token) {
      router.push("/auth");
      return;
    }
    setApplying(true);
    try {
      await jobsApi.apply(id);
      setApplied(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to apply");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (error || !job) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>😕</Text>
        <Text style={styles.errorTitle}>Job not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.card}>
          <Text style={styles.title}>{job.title}</Text>
          {job.client?.clientProfile?.name && (
            <Text style={styles.client}>by {job.client.clientProfile.name}</Text>
          )}
          <View style={[styles.statusBadge, { backgroundColor: "#f0fdf4" }]}>
            <Text style={{ color: "#16a34a", fontSize: 12, fontWeight: "600" }}>
              {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
            </Text>
          </View>
        </View>

        {/* Key Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Daily Budget</Text>
            <Text style={styles.statValue}>{formatCurrency(job.budget)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: "#eff6ff" }]}>
            <Text style={[styles.statLabel, { color: "#1d4ed8" }]}>
              Duration
            </Text>
            <Text style={[styles.statValue, { color: "#1e40af" }]}>
              {DURATION_LABELS[job.duration]}
            </Text>
          </View>
        </View>

        {/* Location */}
        {job.city && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.text}>📍 {job.city}</Text>
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.text}>{job.description}</Text>
        </View>

        {/* Skills */}
        {job.skills.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Required Skills</Text>
            <View style={styles.skillList}>
              {job.skills.map((skill) => (
                <View key={skill} style={styles.skillTag}>
                  <Text style={styles.skillText}>
                    {SKILL_ICONS[skill]} {SKILL_LABELS[skill]}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Posted {timeAgo(job.createdAt)}</Text>
          {job._count?.applications !== undefined && (
            <Text style={styles.footerText}>
              {job._count.applications} applicants
            </Text>
          )}
        </View>

        {/* Apply */}
        {job.status === "open" && (
          <View style={styles.applySection}>
            {applied ? (
              <View style={styles.appliedBox}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>✅</Text>
                <Text style={styles.appliedTitle}>Application Submitted!</Text>
                <Text style={styles.appliedDesc}>
                  The client will contact you if interested.
                </Text>
              </View>
            ) : user?.role === "worker" ? (
              <>
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <TouchableOpacity
                  style={[styles.applyBtn, applying && styles.disabled]}
                  onPress={handleApply}
                  disabled={applying}
                >
                  {applying ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.applyBtnText}>Apply Now →</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : !isAuthenticated ? (
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => router.push("/auth")}
              >
                <Text style={styles.applyBtnText}>Login to Apply</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
    padding: 18,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 4 },
  client: { fontSize: 13, color: "#6b7280", marginBottom: 10 },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statsRow: { flexDirection: "row", gap: 8, marginHorizontal: 12 },
  statCard: {
    flex: 1,
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    padding: 14,
  },
  statLabel: {
    fontSize: 11,
    color: "#16a34a",
    fontWeight: "600",
    marginBottom: 2,
  },
  statValue: { fontSize: 20, fontWeight: "700", color: "#15803d" },
  section: {
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  text: { fontSize: 14, color: "#374151", lineHeight: 20 },
  skillList: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  skillTag: {
    backgroundColor: "#fff7ed",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  skillText: { fontSize: 12, color: "#c2410c", fontWeight: "500" },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 12,
    marginBottom: 4,
  },
  footerText: { fontSize: 11, color: "#9ca3af" },
  applySection: { margin: 12 },
  applyBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  applyBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.6 },
  appliedBox: {
    backgroundColor: "#f0fdf4",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  appliedTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#15803d",
    marginBottom: 4,
  },
  appliedDesc: { fontSize: 13, color: "#16a34a", textAlign: "center" },
  errorText: {
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
  },
});
