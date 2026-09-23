import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { workersApi } from "@/lib/api";
import { WorkerDetailCard } from "@/components/WorkerDetailCard";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import type { WorkerProfile } from "@/types";

interface WorkerWithDistance extends WorkerProfile {
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

function markerColor(name: string): string {
  const colors = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
  return colors[name.charCodeAt(0) % colors.length];
}

export default function WorkersScreen() {
  const router = useRouter();
  const [workers, setWorkers] = useState<WorkerWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerWithDistance | null>(null);
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

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workersApi.list({ page: 1, city: search || undefined });
      const withDist = res.data.map((w) => ({
        ...w,
        distance:
          userLocation && w.latitude && w.longitude
            ? getDistance(userLocation.latitude, userLocation.longitude, w.latitude, w.longitude)
            : undefined,
      }));
      withDist.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
      setWorkers(withDist);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [search, userLocation]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  function centerOnUser() {
    if (userLocation) {
      setRegion({ ...userLocation, latitudeDelta: 0.08, longitudeDelta: 0.08 });
    }
  }

  const nearbyCount = workers.filter((w) => (w.distance ?? Infinity) <= 20).length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by city..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={fetchWorkers}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
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

          {workers.map((w) =>
            w.latitude && w.longitude ? (
              <Marker
                key={w.id}
                coordinate={{ latitude: w.latitude, longitude: w.longitude }}
                title={w.name}
                onPress={() => setSelectedWorker(w)}
              >
                <View style={styles.pin}>
                  <View style={[styles.pinBubble, { backgroundColor: markerColor(w.name) }]}>
                    {w.profilePicture ? (
                      <Image source={{ uri: w.profilePicture }} style={styles.pinImage} />
                    ) : (
                      <Text style={styles.pinInitial}>{w.name[0]?.toUpperCase()}</Text>
                    )}
                  </View>
                  {w.distance !== undefined && (
                    <View style={styles.pinTag}>
                      <Text style={styles.pinTagText}>{w.distance.toFixed(1)} km</Text>
                    </View>
                  )}
                </View>
              </Marker>
            ) : null,
          )}
        </MapView>

        {/* Re-center button */}
        <TouchableOpacity style={styles.recenterBtn} onPress={centerOnUser}>
          <MaterialCommunityIcons name="navigation" size={20} color="#16a34a" />
        </TouchableOpacity>

        {/* Selected worker mini-card */}
        {selectedWorker && (
          <TouchableOpacity
            style={styles.miniCard}
            onPress={() => router.push(`/workers/${selectedWorker.id}`)}
            activeOpacity={0.9}
          >
            <View style={[styles.miniAvatar, { backgroundColor: markerColor(selectedWorker.name) }]}>
              {selectedWorker.profilePicture ? (
                <Image source={{ uri: selectedWorker.profilePicture }} style={styles.miniAvatarImg} />
              ) : (
                <Text style={styles.miniAvatarText}>{selectedWorker.name[0]?.toUpperCase()}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniName} numberOfLines={1}>{selectedWorker.name}</Text>
              {selectedWorker.city && (
                <Text style={styles.miniCity} numberOfLines={1}>
                  <MaterialCommunityIcons name="map-marker" size={11} color="#9ca3af" /> {selectedWorker.city}
                </Text>
              )}
              {selectedWorker.dailyWage && (
                <Text style={styles.miniWage}>PKR {selectedWorker.dailyWage.toLocaleString()}/day</Text>
              )}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#9ca3af" />
            <TouchableOpacity
              style={styles.miniClose}
              onPress={() => setSelectedWorker(null)}
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
            <Text style={styles.panelTitle}>Nearby Workers</Text>
            {!loading && (
              <Text style={styles.panelSub}>
                {nearbyCount > 0 ? `${nearbyCount} within 20 km` : "Showing all workers"}
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.listBtn} onPress={() => router.push("/workers-list")}>
            <MaterialCommunityIcons name="format-list-bulleted" size={14} color="#16a34a" />
            <Text style={styles.listBtnText}>View All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color="#16a34a" style={{ marginVertical: 16 }} />
        ) : (
          <FlatList
            data={workers.slice(0, 5)}
            keyExtractor={(w) => w.id}
            scrollEnabled
            nestedScrollEnabled
            contentContainerStyle={styles.panelList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <WorkerDetailCard
                worker={item}
                onPress={() => router.push(`/workers/${item.id}`)}
              />
            )}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={{ fontSize: 36 }}>👷</Text>
                <Text style={styles.emptyText}>No workers found</Text>
              </View>
            }
            ListFooterComponent={
              workers.length > 5 ? (
                <TouchableOpacity
                  style={styles.seeAllBtn}
                  onPress={() => router.push("/workers-list")}
                >
                  <Text style={styles.seeAllText}>
                    See all {workers.length} workers →
                  </Text>
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
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 6,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827", paddingVertical: 0 },
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
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  pinImage: { width: 44, height: 44, borderRadius: 22 },
  pinInitial: { color: "#fff", fontWeight: "700", fontSize: 16 },
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
  miniAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  miniAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  miniAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  miniName: { fontSize: 14, fontWeight: "700", color: "#111827" },
  miniCity: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  miniWage: { fontSize: 12, color: "#16a34a", fontWeight: "600", marginTop: 2 },
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
