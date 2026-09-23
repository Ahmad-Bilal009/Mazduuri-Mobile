import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { jobsApi } from "@/lib/api";
import { JobDetailCard } from "@/components/JobDetailCard";
import { getCategory } from "@/lib/categories";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import { DURATION_LABELS } from "@/lib/utils";
import type { Job } from "@/types";

interface JobWithDistance extends Job {
  distance?: number;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const CATEGORY_COLORS = ["#f0fdf4", "#eff6ff", "#fef3c7", "#fce7f3", "#f3e8ff"];
const CATEGORY_BORDER = ["#bbf7d0", "#bfdbfe", "#fde68a", "#fbcfe8", "#e9d5ff"];

function categoryStyle(catId: string) {
  const i = catId.charCodeAt(0) % CATEGORY_COLORS.length;
  return { bg: CATEGORY_COLORS[i], border: CATEGORY_BORDER[i] };
}

export default function JobsScreen() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithDistance | null>(null);
  const [region, setRegion] = useState({
    latitude: 31.5204,
    longitude: 74.3587,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;
        setUserLocation({ latitude, longitude });
        setRegion({ latitude, longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 });
      }
    })();
  }, []);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await jobsApi.list({ page: 1, status: "open" });
      const withDist = res.data.map((j) => ({
        ...j,
        distance:
          userLocation && j.latitude && j.longitude
            ? getDistance(userLocation.latitude, userLocation.longitude, j.latitude, j.longitude)
            : undefined,
      }));
      withDist.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
      setJobs(withDist);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [userLocation]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  function centerOnUser() {
    if (userLocation) {
      setRegion({ ...userLocation, latitudeDelta: 0.08, longitudeDelta: 0.08 });
    }
  }

  const nearbyCount = jobs.filter((j) => (j.distance ?? Infinity) <= 20).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Jobs Near You</Text>
        <TouchableOpacity style={styles.pinBtn} onPress={() => setLocationPickerVisible(true)}>
          <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#16a34a" />
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          region={region}
          onRegionChangeComplete={setRegion}
        >
          {userLocation && (
            <Marker coordinate={userLocation} title="You">
              <View style={styles.myDotOuter}>
                <View style={styles.myDot} />
              </View>
            </Marker>
          )}

          {jobs.map((j) =>
            j.latitude && j.longitude ? (
              <Marker
                key={j.id}
                coordinate={{ latitude: j.latitude, longitude: j.longitude }}
                title={j.title}
                onPress={() => setSelectedJob(j)}
              >
                <View style={styles.pin}>
                  <View
                    style={[
                      styles.pinBubble,
                      {
                        backgroundColor: categoryStyle(j.categoryId).bg,
                        borderColor: categoryStyle(j.categoryId).border,
                      },
                    ]}
                  >
                    <Text style={styles.pinIcon}>
                      {getCategory(j.categoryId)?.icon ?? "💼"}
                    </Text>
                  </View>
                  {j.distance !== undefined && (
                    <View style={styles.pinTag}>
                      <Text style={styles.pinTagText}>{j.distance.toFixed(1)} km</Text>
                    </View>
                  )}
                </View>
              </Marker>
            ) : null,
          )}
        </MapView>

        {/* Re-center */}
        <TouchableOpacity style={styles.recenterBtn} onPress={centerOnUser}>
          <MaterialCommunityIcons name="navigation" size={20} color="#16a34a" />
        </TouchableOpacity>

        {/* Selected job mini-card */}
        {selectedJob && (
          <TouchableOpacity
            style={styles.miniCard}
            onPress={() => router.push(`/jobs/${selectedJob.id}`)}
            activeOpacity={0.9}
          >
            <View
              style={[
                styles.miniIcon,
                {
                  backgroundColor: categoryStyle(selectedJob.categoryId).bg,
                  borderColor: categoryStyle(selectedJob.categoryId).border,
                },
              ]}
            >
              <Text style={{ fontSize: 22 }}>
                {getCategory(selectedJob.categoryId)?.icon ?? "💼"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniTitle} numberOfLines={1}>{selectedJob.title}</Text>
              {selectedJob.city && (
                <Text style={styles.miniCity} numberOfLines={1}>
                  <MaterialCommunityIcons name="map-marker" size={11} color="#9ca3af" /> {selectedJob.city}
                </Text>
              )}
              <View style={styles.miniMeta}>
                {selectedJob.budget && (
                  <Text style={styles.miniBudget}>PKR {selectedJob.budget.toLocaleString()}</Text>
                )}
                {selectedJob.duration && (
                  <Text style={styles.miniDuration}>{DURATION_LABELS[selectedJob.duration]}</Text>
                )}
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
            <TouchableOpacity
              style={styles.miniClose}
              onPress={() => setSelectedJob(null)}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="close" size={16} color="#6b7280" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom panel */}
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>Available Jobs</Text>
            {!loading && (
              <Text style={styles.panelSub}>
                {nearbyCount > 0 ? `${nearbyCount} within 20 km` : `${jobs.length} total`}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.listBtn} onPress={() => router.push("/jobs-list")}>
            <MaterialCommunityIcons name="format-list-bulleted" size={14} color="#16a34a" />
            <Text style={styles.listBtnText}>View All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#16a34a" style={{ marginVertical: 16 }} />
        ) : (
          <FlatList
            data={jobs.slice(0, 5)}
            keyExtractor={(j) => j.id}
            scrollEnabled
            nestedScrollEnabled
            contentContainerStyle={styles.panelList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <JobDetailCard job={item} onPress={() => router.push(`/jobs/${item.id}`)} />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ fontSize: 36 }}>💼</Text>
                <Text style={styles.emptyText}>No jobs found nearby</Text>
              </View>
            }
            ListFooterComponent={
              jobs.length > 5 ? (
                <TouchableOpacity style={styles.seeAllBtn} onPress={() => router.push("/jobs-list")}>
                  <Text style={styles.seeAllText}>See all {jobs.length} jobs →</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        )}
      </View>

      <MapLocationPicker
        visible={locationPickerVisible}
        onLocationSelected={(loc) => {
          setUserLocation({ latitude: loc.latitude, longitude: loc.longitude });
          setRegion({ latitude: loc.latitude, longitude: loc.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 });
          setLocationPickerVisible(false);
        }}
        onCancel={() => setLocationPickerVisible(false)}
        initialLocation={userLocation ?? undefined}
        title="Set Your Location"
      />
    </SafeAreaView>
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
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  pinBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  mapWrap: { flex: 1, position: "relative" },
  map: { flex: 1 },
  myDotOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(37,99,235,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#2563eb",
  },
  myDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#2563eb" },
  pin: { alignItems: "center" },
  pinBubble: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  pinIcon: { fontSize: 22 },
  pinTag: {
    backgroundColor: "#fff",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginTop: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  pinTagText: { fontSize: 10, fontWeight: "700", color: "#111827" },
  recenterBtn: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  miniCard: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 72,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  miniIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  miniTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  miniCity: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  miniMeta: { flexDirection: "row", gap: 8, marginTop: 2 },
  miniBudget: { fontSize: 12, color: "#16a34a", fontWeight: "700" },
  miniDuration: { fontSize: 12, color: "#6b7280" },
  miniClose: { position: "absolute", top: 8, right: 8 },
  panel: {
    maxHeight: "42%",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  panelTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  panelSub: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  listBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  listBtnText: { fontSize: 12, fontWeight: "600", color: "#16a34a" },
  panelList: { paddingHorizontal: 12, paddingBottom: 12 },
  empty: { alignItems: "center", paddingVertical: 20, gap: 6 },
  emptyText: { fontSize: 14, color: "#9ca3af", fontWeight: "500" },
  seeAllBtn: {
    marginHorizontal: 4,
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 12,
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  seeAllText: { fontSize: 14, fontWeight: "700", color: "#16a34a" },
});
