import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Image,
  Alert,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { workersApi } from "@/lib/api";
import { useSavedStore } from "@/store/savedStore";
import { useAuthStore } from "@/store/authStore";
import { BackButton } from "@/components/BackButton";
import { getCategory } from "@/lib/categories";
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
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <SavedTile worker={item} onPress={() => router.push(`/workers/${item.id}`)} />
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

function SavedTile({ worker, onPress }: { worker: WorkerProfile; onPress: () => void }) {
  const toggleSaved = useSavedStore((s) => s.toggle);
  const trade = worker.categoryIds?.[0] ? getCategory(worker.categoryIds[0])?.name : undefined;
  const hasRating = (worker.rating ?? 0) > 0;

  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} activeOpacity={0.9}>
      <View style={[styles.photo, { backgroundColor: tileColor(worker.name) }]}>
        {worker.profilePicture ? (
          <Image source={{ uri: worker.profilePicture }} style={styles.photoImg} />
        ) : (
          <Text style={styles.photoInitial}>{worker.name[0]?.toUpperCase()}</Text>
        )}
        <TouchableOpacity
          style={styles.heart}
          hitSlop={8}
          onPress={() =>
            toggleSaved(worker.id).catch(() =>
              Alert.alert("Error", "Could not update your saved workers."),
            )
          }
        >
          <MaterialCommunityIcons name="heart" size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
      <View style={styles.tileBody}>
        <Text style={styles.tileName} numberOfLines={1}>
          {worker.name}
        </Text>
        {trade ? (
          <Text style={styles.tileTrade} numberOfLines={1}>
            {trade}
          </Text>
        ) : null}
        <View style={styles.tileRating}>
          <MaterialCommunityIcons name="star" size={15} color="#facc15" />
          <Text style={styles.tileRatingText}>{hasRating ? worker.rating.toFixed(1) : "New"}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function tileColor(name: string): string {
  const colors = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
  return colors[name.charCodeAt(0) % colors.length];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 19, fontWeight: "800", color: "#0f172a" },
  gridRow: { gap: 12 },
  tile: {
    flex: 1,
    maxWidth: "50%",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    marginBottom: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  photo: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  photoImg: { width: "100%", height: "100%" },
  photoInitial: { color: "#fff", fontSize: 44, fontWeight: "800" },
  heart: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  tileBody: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12 },
  tileName: { fontSize: 15.5, fontWeight: "700", color: "#0f172a" },
  tileTrade: { fontSize: 13, color: "#64748b", marginTop: 2 },
  tileRating: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  tileRatingText: { fontSize: 13.5, fontWeight: "700", color: "#0f172a" },
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
