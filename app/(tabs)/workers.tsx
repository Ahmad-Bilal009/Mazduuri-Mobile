import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { workersApi } from "@/lib/api";
import { WorkerCard } from "@/components/WorkerCard";
import type { WorkerProfile } from "@/types";

export default function WorkersScreen() {
  const router = useRouter();
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const fetchWorkers = useCallback(
    async (pg = 1, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const res = await workersApi.list({
          city: search || undefined,
          page: pg,
        });
        if (append) setWorkers((prev) => [...prev, ...res.data]);
        else setWorkers(res.data);
        setHasMore(res.hasMore);
        setPage(pg);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load workers");
      } finally {
        setLoading(false);
      }
    },
    [search],
  );

  useEffect(() => {
    fetchWorkers(1);
  }, [fetchWorkers]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.searchBar}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by city..."
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => fetchWorkers(1)}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchWorkers(1)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(w) => w.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <WorkerCard
              worker={item}
              onPress={() => router.push(`/workers/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.empty}>
                <Text style={{ fontSize: 40 }}>👷</Text>
                <Text style={styles.emptyTitle}>No workers found</Text>
                <Text style={styles.emptyDesc}>
                  Try a different city or search term
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
                onPress={() => fetchWorkers(page + 1, true)}
              >
                <Text style={styles.loadMoreText}>Load More</Text>
              </TouchableOpacity>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, fontSize: 15, color: "#111827" },
  list: { paddingHorizontal: 12, paddingBottom: 80 },
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
  errorBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: "#ef4444",
    textAlign: "center",
  },
  retryBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
