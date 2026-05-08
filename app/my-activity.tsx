import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { jobsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { formatCurrency, timeAgo } from "@/lib/utils";
import type { Job, JobApplication } from "@/types";

export default function MyActivityScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [items, setItems] = useState<Job[] | JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    jobsApi
      .getMy()
      .then(setItems)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const isClientView = user?.role === "client";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={items as (Job | JobApplication)[]}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.heading}>
            {isClientView ? "My Posted Jobs" : "My Applications"}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 40 }}>💼</Text>
            <Text style={styles.emptyTitle}>
              {isClientView ? "No jobs posted yet" : "No applications yet"}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (isClientView) {
            const job = item as Job;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push(`/jobs/${job.id}`)}
              >
                <Text style={styles.cardTitle}>{job.title}</Text>
                <Text style={styles.cardSub}>
                  {job.city} · {formatCurrency(job.budget)}/day
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.cardMeta}>{job._count?.applications ?? 0} applicants</Text>
                  <View style={[styles.statusBadge, getStatusStyle(job.status)]}>
                    <Text style={[styles.statusText, getStatusTextStyle(job.status)]}>
                      {job.status}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }

          const application = item as JobApplication;
          const job = application.job;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => job && router.push(`/jobs/${job.id}`)}
            >
              <Text style={styles.cardTitle}>{job?.title ?? "Job"}</Text>
              <Text style={styles.cardSub}>
                {job?.city} · {job ? formatCurrency(job.budget) + "/day" : ""}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.cardMeta}>Applied {timeAgo(application.createdAt)}</Text>
                <View style={[styles.statusBadge, getApplicationStatusStyle(application.status)]}>
                  <Text style={[styles.statusText, getApplicationStatusTextStyle(application.status)]}>
                    {application.status}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function getStatusStyle(status: string) {
  if (status === "open") return { backgroundColor: "#f0fdf4" };
  if (status === "in_progress") return { backgroundColor: "#eff6ff" };
  return { backgroundColor: "#f3f4f6" };
}
function getStatusTextStyle(status: string) {
  if (status === "open") return { color: "#16a34a" };
  if (status === "in_progress") return { color: "#1d4ed8" };
  return { color: "#6b7280" };
}
function getApplicationStatusStyle(status: string) {
  if (status === "accepted") return { backgroundColor: "#f0fdf4" };
  if (status === "rejected") return { backgroundColor: "#fef2f2" };
  return { backgroundColor: "#fffbeb" };
}
function getApplicationStatusTextStyle(status: string) {
  if (status === "accepted") return { color: "#16a34a" };
  if (status === "rejected") return { color: "#ef4444" };
  return { color: "#d97706" };
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 16, paddingBottom: 80 },
  heading: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 4 },
  cardSub: { fontSize: 13, color: "#6b7280", marginBottom: 10 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardMeta: { fontSize: 12, color: "#9ca3af" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
  errorText: { color: "#ef4444", fontSize: 14 },
});