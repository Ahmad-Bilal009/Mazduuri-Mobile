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
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { BackButton } from "@/components/BackButton";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { Platform } from "react-native";
import * as Location from "expo-location";
import { workersApi } from "@/lib/api";
import { WorkerDetailCard } from "@/components/WorkerDetailCard";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import type { WorkerProfile } from "@/types";
import { formatCurrency } from "@/lib/utils";

interface WorkerWithDistance extends WorkerProfile {
  distance?: number;
}

export default function WorkersMapScreen() {
  const router = useRouter();
  const [workers, setWorkers] = useState<WorkerWithDistance[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<WorkerWithDistance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [region, setRegion] = useState({
    latitude: 31.5204,
    longitude: 74.3587,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  // Request location permission
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const location = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = location.coords;
        setUserLocation({ latitude, longitude });
        setRegion({
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
    })();
  }, []);

  // Fetch workers
  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await workersApi.list({
        page: 1,
        city: search || undefined,
      });
      const workersWithDistance = res.data.map((worker) => ({
        ...worker,
        distance: userLocation && worker.latitude && worker.longitude
          ? getDistance(
              userLocation.latitude,
              userLocation.longitude,
              worker.latitude,
              worker.longitude
            )
          : undefined,
      }));
      
      // Sort by distance
      const sorted = workersWithDistance.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
      setWorkers(sorted);
      setFilteredWorkers(sorted);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, userLocation]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  // Calculate distance between two coordinates in km
  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.container}>
        {/* Header with Search and Filter */}
        <View style={styles.header}>
          <BackButton style={{ marginRight: 8 }} />
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search by city or area..."
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Text style={{ color: "#9ca3af", fontSize: 18 }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.filterBtn}>
            <Text style={styles.filterBtnText}>Filter</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.locationSelectBtn}
            onPress={() => setLocationPickerVisible(true)}
          >
            <Text style={styles.locationSelectBtnText}>📌</Text>
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            region={region}
            onRegionChange={setRegion}
          >
            {/* User Location Marker */}
            {userLocation && (
              <Marker
                coordinate={userLocation}
                title="My Location"
              >
                <View style={styles.userLocationMarker}>
                  <View style={styles.userLocationDot} />
                </View>
              </Marker>
            )}

            {/* Worker Markers */}
            {workers.map((worker) =>
              worker.latitude && worker.longitude ? (
                <Marker
                  key={worker.id}
                  coordinate={{
                    latitude: worker.latitude,
                    longitude: worker.longitude,
                  }}
                  title={worker.name}
                  onPress={() => router.push(`/workers/${worker.id}`)}
                >
                  <View style={styles.markerContainer}>
                    <View
                      style={[
                        styles.marker,
                        { backgroundColor: getColor(worker.name) },
                      ]}
                    >
                      {worker.profilePicture ? (
                        <Image
                          source={{ uri: worker.profilePicture }}
                          style={styles.markerImage}
                        />
                      ) : (
                        <Text style={styles.markerText}>
                          {worker.name[0]?.toUpperCase()}
                        </Text>
                      )}
                    </View>
                    {worker.distance && (
                      <Text style={styles.markerDistance}>
                        {worker.distance.toFixed(1)} km
                      </Text>
                    )}
                  </View>
                </Marker>
              ) : null
            )}
          </MapView>

          {/* Location Button */}
          <TouchableOpacity
            style={styles.locationBtn}
            onPress={() => {
              if (userLocation) {
                setRegion({
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                });
              }
            }}
          >
            <MaterialCommunityIcons name="map-marker" size={20} color="#16a34a" />
          </TouchableOpacity>
        </View>

        {/* Nearest Workers List */}
        <View style={styles.listContainer}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Nearest Workers</Text>
            <TouchableOpacity>
              <Text style={styles.filterLink}>Within 5 km</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator
              color="#16a34a"
              size="large"
              style={{ marginVertical: 20 }}
            />
          ) : (
            <FlatList
              data={filteredWorkers.slice(0, 5)}
              keyExtractor={(w) => w.id}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              contentContainerStyle={styles.workersList}
              renderItem={({ item }) => (
                <WorkerDetailCard
                  worker={item}
                  onPress={() => router.push(`/workers/${item.id}`)}
                />
              )}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={{ fontSize: 40 }}>👷</Text>
                  <Text style={styles.emptyTitle}>No workers found</Text>
                </View>
              }
            />
          )}
        </View>

        {/* Location Picker Modal */}
        <MapLocationPicker
          visible={locationPickerVisible}
          onLocationSelected={(location) => {
            setUserLocation({ latitude: location.latitude, longitude: location.longitude });
            setRegion({
              latitude: location.latitude,
              longitude: location.longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            });
            setLocationPickerVisible(false);
          }}
          onCancel={() => setLocationPickerVisible(false)}
          initialLocation={userLocation || undefined}
          title="Select Your Location"
        />
      </View>
    </SafeAreaView>
  );
}

function getColor(name: string): string {
  const colors = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
  return colors[name.charCodeAt(0) % colors.length];
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    alignItems: "center",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderRadius: 24,
    paddingHorizontal: 12,
    alignItems: "center",
    gap: 8,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    paddingVertical: 10,
  },
  filterBtn: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  locationSelectBtn: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#dcfce7",
  },
  locationSelectBtnText: {
    fontSize: 16,
  },
  mapContainer: { flex: 1, position: "relative" },
  map: { flex: 1 },
  markerContainer: { alignItems: "center" },
  marker: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  markerImage: { width: 48, height: 48, borderRadius: 24 },
  markerText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  markerDistance: {
    backgroundColor: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: "600",
    color: "#111827",
    marginTop: 4,
  },
  userLocationMarker: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(37, 99, 235, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#2563eb",
  },
  userLocationDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2563eb",
  },
  locationBtn: {
    position: "absolute",
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  locationBtnText: { fontSize: 20 },
  listContainer: {
    maxHeight: "60%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  filterLink: {
    fontSize: 13,
    color: "#16a34a",
    fontWeight: "600",
  },
  workersList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  empty: {
    alignItems: "center",
    paddingVertical: 30,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 8,
  },
});
