import { useState, useEffect, useMemo, useRef } from "react";
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
  ScrollView,
  Modal,
  Switch,
  Pressable,
  useWindowDimensions,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { workersApi } from "@/lib/api";
import { getAllCategories } from "@/lib/categories";
import { formatCurrency, mapHeightFor } from "@/lib/utils";
import { WorkerDetailCard } from "@/components/WorkerDetailCard";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import type { WorkerProfile } from "@/types";

interface WorkerWithDistance extends WorkerProfile {
  distance?: number;
}

type QuickFilter = "all" | "top" | "nearby" | "available";

interface SheetFilters {
  categoryId?: string;
  minWage?: number;
  maxWage?: number;
}

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "top", label: "Top Rated" },
  { key: "nearby", label: "Nearby" },
  { key: "available", label: "Available" },
];

const NEARBY_KM = 20;
const DEFAULT_DELTA = { latitudeDelta: 0.08, longitudeDelta: 0.08 };

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
  const mapRef = useRef<MapView>(null);
  const { height: windowHeight } = useWindowDimensions();

  const [workers, setWorkers] = useState<WorkerWithDistance[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [city, setCity] = useState(""); // debounced search
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [filters, setFilters] = useState<SheetFilters>({});
  const [sheetVisible, setSheetVisible] = useState(false);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState<WorkerWithDistance | null>(null);
  const [initialRegion] = useState<Region>({ latitude: 31.5204, longitude: 74.3587, ...DEFAULT_DELTA });

  // Current location
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserLocation(coords);
      mapRef.current?.animateToRegion({ ...coords, ...DEFAULT_DELTA }, 400);
    })();
  }, []);

  // Debounce the city search so typing doesn't fire a request per keystroke
  useEffect(() => {
    const t = setTimeout(() => setCity(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Fetch from the API whenever server-side filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    workersApi
      .list({
        page: 1,
        limit: 30,
        city: city || undefined,
        categoryIds: filters.categoryId ? [filters.categoryId] : undefined,
        minWage: filters.minWage,
        maxWage: filters.maxWage,
        available: quick === "available" ? true : undefined,
      })
      .then((res) => {
        if (cancelled) return;
        setWorkers(res.data);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) setWorkers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city, filters, quick === "available"]);

  // Distance + client-side quick filters
  const visible = useMemo<WorkerWithDistance[]>(() => {
    let list = workers.map((w) => ({
      ...w,
      distance:
        userLocation && w.latitude && w.longitude
          ? getDistance(userLocation.latitude, userLocation.longitude, w.latitude, w.longitude)
          : undefined,
    }));
    if (quick === "nearby") {
      list = list.filter((w) => (w.distance ?? Infinity) <= NEARBY_KM);
    }
    if (quick === "top") {
      list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.totalJobs ?? 0) - (a.totalJobs ?? 0));
    } else {
      list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }
    return list;
  }, [workers, userLocation, quick]);

  const activeFilterCount =
    (filters.categoryId ? 1 : 0) + (filters.minWage || filters.maxWage ? 1 : 0);

  function selectQuick(key: QuickFilter) {
    if (key === "nearby" && !userLocation) {
      setLocationPickerVisible(true);
    }
    setQuick(key);
  }

  function centerOnUser() {
    if (userLocation) {
      mapRef.current?.animateToRegion({ ...userLocation, ...DEFAULT_DELTA }, 400);
    } else {
      setLocationPickerVisible(true);
    }
  }

  const subtitle =
    quick === "nearby"
      ? `${visible.length} ${visible.length === 1 ? "worker" : "workers"} within ${NEARBY_KM} km`
      : quick === "top"
        ? "Highest rated workers first"
        : quick === "available"
          ? "Workers available right now"
          : city
            ? `Showing workers in "${city}"`
            : "Showing all workers around you";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* ── Search ─────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by city..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            onSubmitEditing={() => setCity(search.trim())}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.locateBtn} onPress={() => setLocationPickerVisible(true)}>
          <MaterialCommunityIcons name="crosshairs-gps" size={22} color="#16a34a" />
        </TouchableOpacity>
      </View>

      {/* ── Filter chips ───────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        <TouchableOpacity style={styles.filtersChip} onPress={() => setSheetVisible(true)}>
          <MaterialCommunityIcons name="tune-variant" size={16} color="#fff" />
          <Text style={styles.filtersChipText}>Filters</Text>
          {activeFilterCount > 0 && (
            <View style={styles.filtersBadge}>
              <Text style={styles.filtersBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        {QUICK_FILTERS.map((f) => {
          const active = quick === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => selectQuick(f.key)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Map card (stays fixed while the list scrolls) ──── */}
      <View style={[styles.mapCard, { height: mapHeightFor(windowHeight) }]}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          showsPointsOfInterests={false}
          toolbarEnabled={false}
          onPress={() => setSelectedWorker(null)}
        >
          {userLocation && (
            <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.meHalo}>
                <View style={styles.meDot}>
                  <View style={styles.meDotInner} />
                </View>
              </View>
            </Marker>
          )}

          {visible.map((w) =>
            w.latitude && w.longitude ? (
              <Marker
                key={w.id}
                coordinate={{ latitude: w.latitude, longitude: w.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedWorker(w);
                }}
              >
                <View style={[styles.pin, { backgroundColor: markerColor(w.name) }]}>
                  {w.profilePicture ? (
                    <Image source={{ uri: w.profilePicture }} style={styles.pinImage} />
                  ) : (
                    <Text style={styles.pinInitial}>{w.name[0]?.toUpperCase()}</Text>
                  )}
                </View>
              </Marker>
            ) : null,
          )}
        </MapView>

        <TouchableOpacity style={styles.recenterBtn} onPress={centerOnUser}>
          <MaterialCommunityIcons name="send-outline" size={20} color="#16a34a" />
        </TouchableOpacity>

        {selectedWorker && (
          <TouchableOpacity
            style={styles.miniCard}
            activeOpacity={0.9}
            onPress={() => router.push(`/workers/${selectedWorker.id}`)}
          >
            <View style={[styles.miniAvatar, { backgroundColor: markerColor(selectedWorker.name) }]}>
              {selectedWorker.profilePicture ? (
                <Image source={{ uri: selectedWorker.profilePicture }} style={styles.miniAvatarImg} />
              ) : (
                <Text style={styles.miniAvatarText}>{selectedWorker.name[0]?.toUpperCase()}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.miniName} numberOfLines={1}>
                {selectedWorker.name}
              </Text>
              <Text style={styles.miniMeta} numberOfLines={1}>
                {formatCurrency(selectedWorker.dailyWage)}/day
                {selectedWorker.distance !== undefined ? ` · ${selectedWorker.distance.toFixed(1)} km` : ""}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Worker list ────────────────────────────────────── */}
      <FlatList
        data={loading ? [] : visible}
        keyExtractor={(w) => w.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>Nearby Workers</Text>
              <Text style={styles.listSub} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <TouchableOpacity style={styles.viewAllBtn} onPress={() => router.push("/workers-list")}>
              <MaterialCommunityIcons name="format-list-bulleted" size={16} color="#16a34a" />
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <WorkerDetailCard
            worker={item}
            showSaveButton={false}
            onPress={() => router.push(`/workers/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#16a34a" style={{ marginVertical: 24 }} />
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="account-search-outline" size={40} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No workers found</Text>
              <Text style={styles.emptySub}>Try another city or clear your filters.</Text>
            </View>
          )
        }
        ListFooterComponent={
          !loading && total > workers.length ? (
            <TouchableOpacity style={styles.seeAllBtn} onPress={() => router.push("/workers-list")}>
              <Text style={styles.seeAllText}>See all {total} workers</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color="#16a34a" />
            </TouchableOpacity>
          ) : null
        }
      />

      <FiltersSheet
        visible={sheetVisible}
        value={filters}
        onClose={() => setSheetVisible(false)}
        onApply={(f) => {
          setFilters(f);
          setSheetVisible(false);
        }}
        availableOnly={quick === "available"}
        onAvailableChange={(on) => setQuick(on ? "available" : "all")}
      />

      <MapLocationPicker
        visible={locationPickerVisible}
        onLocationSelected={(loc) => {
          const coords = { latitude: loc.latitude, longitude: loc.longitude };
          setUserLocation(coords);
          mapRef.current?.animateToRegion({ ...coords, ...DEFAULT_DELTA }, 400);
          setLocationPickerVisible(false);
        }}
        onCancel={() => setLocationPickerVisible(false)}
        initialLocation={userLocation ?? undefined}
        title="Set Your Location"
      />
    </SafeAreaView>
  );
}

// ─── Filters bottom sheet ─────────────────────────────────────────────────────

function FiltersSheet({
  visible,
  value,
  onClose,
  onApply,
  availableOnly,
  onAvailableChange,
}: {
  visible: boolean;
  value: SheetFilters;
  onClose: () => void;
  onApply: (f: SheetFilters) => void;
  availableOnly: boolean;
  onAvailableChange: (on: boolean) => void;
}) {
  const categories = useMemo(() => getAllCategories(), []);
  const [categoryId, setCategoryId] = useState<string | undefined>(value.categoryId);
  const [minWage, setMinWage] = useState(value.minWage ? String(value.minWage) : "");
  const [maxWage, setMaxWage] = useState(value.maxWage ? String(value.maxWage) : "");

  // Re-seed the draft from applied values each time the sheet opens
  useEffect(() => {
    if (!visible) return;
    setCategoryId(value.categoryId);
    setMinWage(value.minWage ? String(value.minWage) : "");
    setMaxWage(value.maxWage ? String(value.maxWage) : "");
  }, [visible]);

  const toNum = (s: string) => {
    const n = parseInt(s.replace(/[^0-9]/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Filters</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <MaterialCommunityIcons name="close" size={22} color="#0f172a" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          <Text style={styles.sheetLabel}>Category</Text>
          <View style={styles.sheetChips}>
            {categories.map((c) => {
              const active = categoryId === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.sheetChip, active && styles.sheetChipActive]}
                  onPress={() => setCategoryId(active ? undefined : c.id)}
                >
                  <Text style={[styles.sheetChipText, active && styles.sheetChipTextActive]}>
                    {c.icon} {c.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.sheetLabel}>Daily wage (Rs.)</Text>
          <View style={styles.wageRow}>
            <TextInput
              style={styles.wageInput}
              placeholder="Min"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              value={minWage}
              onChangeText={setMinWage}
            />
            <Text style={{ color: "#94a3b8" }}>–</Text>
            <TextInput
              style={styles.wageInput}
              placeholder="Max"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              value={maxWage}
              onChangeText={setMaxWage}
            />
          </View>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.switchTitle}>Available now</Text>
              <Text style={styles.switchSub}>Only show workers ready to take a job</Text>
            </View>
            <Switch
              value={availableOnly}
              onValueChange={onAvailableChange}
              trackColor={{ true: "#86efac", false: "#e2e8f0" }}
              thumbColor={availableOnly ? "#16a34a" : "#fff"}
            />
          </View>
        </ScrollView>

        <View style={styles.sheetActions}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => {
              setCategoryId(undefined);
              setMinWage("");
              setMaxWage("");
              onAvailableChange(false);
              onApply({});
            }}
          >
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => onApply({ categoryId, minWage: toNum(minWage), maxWage: toNum(maxWage) })}
          >
            <Text style={styles.applyText}>Apply filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchBar: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 15, color: "#0f172a", paddingVertical: 0 },
  locateBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },

  chipsScroll: { flexGrow: 0 },
  chipsRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filtersChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#0f172a",
  },
  filtersChipText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  filtersBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#22c55e",
    alignItems: "center",
    justifyContent: "center",
  },
  filtersBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipActive: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  chipText: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  chipTextActive: { color: "#15803d" },

  mapCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#e5e7eb",
  },
  meHalo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(34,197,94,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  meDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#22c55e",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  meDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  pin: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 3,
    borderColor: "#fff",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pinImage: { width: 36, height: 36, borderRadius: 18 },
  pinInitial: { color: "#fff", fontWeight: "700", fontSize: 15 },
  recenterBtn: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  miniCard: {
    position: "absolute",
    left: 12,
    right: 68,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  miniAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  miniAvatarImg: { width: 40, height: 40 },
  miniAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  miniName: { fontSize: 14, fontWeight: "700", color: "#0f172a" },
  miniMeta: { fontSize: 12, color: "#16a34a", fontWeight: "600", marginTop: 2 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 18,
    paddingBottom: 12,
  },
  listTitle: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  listSub: { fontSize: 13, color: "#475569", marginTop: 2 },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#dcfce7",
  },
  viewAllText: { fontSize: 14, fontWeight: "700", color: "#16a34a" },
  empty: { alignItems: "center", paddingVertical: 32, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#334155" },
  emptySub: { fontSize: 13, color: "#94a3b8" },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#dcfce7",
  },
  seeAllText: { fontSize: 14, fontWeight: "700", color: "#16a34a" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)" },
  sheet: {
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    marginTop: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  sheetLabel: { fontSize: 13, fontWeight: "700", color: "#475569", marginTop: 8, marginBottom: 10 },
  sheetChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  sheetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  sheetChipActive: { backgroundColor: "#dcfce7", borderColor: "#86efac" },
  sheetChipText: { fontSize: 13, color: "#0f172a", fontWeight: "500" },
  sheetChipTextActive: { color: "#15803d", fontWeight: "700" },
  wageRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  wageInput: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  switchTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  switchSub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  sheetActions: { flexDirection: "row", gap: 10, paddingTop: 12 },
  resetBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
  },
  resetText: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  applyBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22c55e",
  },
  applyText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
