import { useState, useEffect, useCallback } from "react";
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
import { JobCard } from "@/components/JobCard";
import type { Job } from "@/types";

export default function JobsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchJobs = useCallback(async (pg = 1, append = false) => {
    setLoading(true);
    try {
      const res = await jobsApi.list({ page: pg, status: "open" });
      if (append) setJobs((prev) => [...prev, ...res.data]);
      else setJobs(res.data);
      setHasMore(res.hasMore);
      setPage(pg);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs(1);
  }, [fetchJobs]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <JobCard
            job={item}
            onPress={() => router.push(`/jobs/${item.id}`)}
          />
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Available Jobs</Text>
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>💼</Text>
              <Text style={styles.emptyTitle}>No jobs posted yet</Text>
              <Text style={styles.emptyDesc}>
                Check back later for new jobs
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          loading ? (
            <ActivityIndicator color="#16a34a" style={{ marginVertical: 20 }} />
          ) : hasMore ? (
            <TouchableOpacity
              style={styles.loadMore}
              onPress={() => fetchJobs(page + 1, true)}
            >
              <Text style={styles.loadMoreText}>Load More</Text>
            </TouchableOpacity>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  list: { paddingHorizontal: 12, paddingBottom: 80 },
  header: { paddingVertical: 12 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#374151" },
  emptyDesc: { fontSize: 13, color: "#9ca3af" },
  loadMore: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginVertical: 8,
  },
  loadMoreText: { color: "#374151", fontWeight: "600", fontSize: 14 },
});
