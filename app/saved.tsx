import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { workersApi } from "@/lib/api";
import { useSavedStore } from "@/store/savedStore";
import { useAuthStore } from "@/store/authStore";
import { WorkerDetailCard } from "@/components/WorkerDetailCard";
import { BackButton } from "@/components/BackButton";
import type { WorkerProfile } from "@/types";

export default function SavedWorkersScreen() {
  const router = useRouter();
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const savedIds = useSavedStore((s) => s.ids);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const load = useCallback(async (silent = false) => {
    // Reachable by direct navigation; a guest would otherwise see the generic
    // "session expired" error from the 401.
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    setError("");
    try {
      const res = await workersApi.listSaved();
      setWorkers(res.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load saved workers");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  // Refetch on focus so a worker unsaved from their profile disappears here.
  useFocusEffect(
    useCallback(() => {
      load(true);
    }, [load]),
  );

  // Hide rows unsaved in this session without waiting for a refetch.
  const visible = workers.filter((w) => savedIds.has(w.id));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Saved Workers</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(w) => w.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              tintColor="#16a34a"
            />
          }
          renderItem={({ item }) => (
            <WorkerDetailCard
              worker={item}
              onPress={() => router.push(`/workers/${item.id}`)}
            />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="heart-outline" size={52} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {isAuthenticated ? "No saved workers yet" : "Log in to save workers"}
              </Text>
              <Text style={styles.emptyDesc}>
                {isAuthenticated
                  ? "Tap the heart on any worker to keep them here for later."
                  : "Saved workers are tied to your account. Browsing stays free."}
              </Text>
              <TouchableOpacity
                style={styles.browseBtn}
                onPress={() =>
                  router.push(isAuthenticated ? "/workers-list" : "/auth")
                }
              >
                <Text style={styles.browseBtnText}>
                  {isAuthenticated ? "Browse Workers" : "Log in"}
                </Text>
              </TouchableOpacity>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
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
  list: { padding: 16, paddingBottom: 32 },
  empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#374151", marginTop: 14 },
  emptyDesc: {
    fontSize: 13.5,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 6,
  },
  browseBtn: {
    marginTop: 20,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  browseBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
