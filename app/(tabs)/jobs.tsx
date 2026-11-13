import { useState, useEffect, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Platform,
  ScrollView,
  Modal,
  Pressable,
  useWindowDimensions,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from "react-native-maps";
import * as Location from "expo-location";
import { jobsApi } from "@/lib/api";
import { getAllCategories } from "@/lib/categories";
import { categoryIcon, categoryVisual } from "@/lib/categoryIcons";
import { CategoryIcon } from "@/components/CategoryIcon";
import { formatCurrency, DURATION_LABELS, jobCategoryId, mapCategoriesToSkills, mapHeightFor } from "@/lib/utils";
import { JobDetailCard } from "@/components/JobDetailCard";
import { MapLocationPicker } from "@/components/MapLocationPicker";
import type { Job, JobDuration } from "@/types";

interface JobWithDistance extends Job {
  distance?: number;
}

type QuickFilter = "all" | "nearby" | "newest" | "top_pay";

interface SheetFilters {
  categoryId?: string;
  minBudget?: number;
  maxBudget?: number;
  duration?: JobDuration;
}

const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "nearby", label: "Nearby" },
  { key: "newest", label: "Newest" },
  { key: "top_pay", label: "Top Paying" },
];

const DURATIONS: JobDuration[] = ["one_day", "few_days", "one_week", "one_month", "ongoing"];

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

export default function JobsScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const { height: windowHeight } = useWindowDimensions();

  const [jobs, setJobs] = useState<JobWithDistance[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [city, setCity] = useState(""); // debounced search
  const [quick, setQuick] = useState<QuickFilter>("all");
  const [filters, setFilters] = useState<SheetFilters>({});
  const [sheetVisible, setSheetVisible] = useState(false);

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobWithDistance | null>(null);
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
    jobsApi
      .list({
        page: 1,
        limit: 30,
        status: "open",
        city: city || undefined,
        skills: filters.categoryId ? mapCategoriesToSkills([filters.categoryId]) : undefined,
        minBudget: filters.minBudget,
        maxBudget: filters.maxBudget,
      })
      .then((res) => {
        if (cancelled) return;
        setJobs(res.data);
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled) setJobs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city, filters.categoryId, filters.minBudget, filters.maxBudget]);

  // Distance + client-side quick filters
  const visible = useMemo<JobWithDistance[]>(() => {
    let list = jobs.map((j) => ({
      ...j,
      distance:
        userLocation && j.latitude && j.longitude
          ? getDistance(userLocation.latitude, userLocation.longitude, j.latitude, j.longitude)
          : undefined,
    }));
    if (filters.duration) list = list.filter((j) => j.duration === filters.duration);
    if (quick === "nearby") list = list.filter((j) => (j.distance ?? Infinity) <= NEARBY_KM);

    if (quick === "newest") {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (quick === "top_pay") {
      list.sort((a, b) => (b.budget ?? 0) - (a.budget ?? 0));
    } else {
      list.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    }
    return list;
  }, [jobs, userLocation, quick, filters.duration]);

  const activeFilterCount =
    (filters.categoryId ? 1 : 0) +
    (filters.minBudget || filters.maxBudget ? 1 : 0) +
    (filters.duration ? 1 : 0);

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
      ? `${visible.length} ${visible.length === 1 ? "job" : "jobs"} within ${NEARBY_KM} km`
      : quick === "newest"
        ? "Most recently posted first"
        : quick === "top_pay"
          ? "Highest budgets first"
          : city
            ? `Showing jobs in "${city}"`
            : "Showing all open jobs around you";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* ── Search ─────────────────────────────────────────── */}
      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search jobs by city..."
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
          onPress={() => setSelectedJob(null)}
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

          {visible.map((j) =>
            j.latitude && j.longitude ? (
              <Marker
                key={j.id}
                coordinate={{ latitude: j.latitude, longitude: j.longitude }}
                anchor={{ x: 0.5, y: 0.5 }}
                onPress={(e) => {
                  e.stopPropagation();
                  setSelectedJob(j);
                }}
              >
                <View style={[styles.pin, { backgroundColor: categoryVisual(jobCategoryId(j)).fg }]}>
                  <MaterialCommunityIcons name={categoryIcon(jobCategoryId(j))} size={20} color="#fff" />
                </View>
              </Marker>
            ) : null,
          )}
        </MapView>

        <TouchableOpacity style={styles.recenterBtn} onPress={centerOnUser}>
          <MaterialCommunityIcons name="send-outline" size={20} color="#16a34a" />
        </TouchableOpacity>

        {selectedJob && (
          <TouchableOpacity
            style={styles.miniCard}
            activeOpacity={0.9}
            onPress={() => router.push(`/jobs/${selectedJob.id}`)}
          >
            <CategoryIcon id={jobCategoryId(selectedJob)} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.miniName} numberOfLines={1}>
                {selectedJob.title}
              </Text>
              <Text style={styles.miniMeta} numberOfLines={1}>
                {formatCurrency(selectedJob.budget)} · {DURATION_LABELS[selectedJob.duration]}
                {selectedJob.distance !== undefined ? ` · ${selectedJob.distance.toFixed(1)} km` : ""}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Job list ───────────────────────────────────────── */}
      <FlatList
        data={loading ? [] : visible}
        keyExtractor={(j) => j.id}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.listTitle}>Nearby Jobs</Text>
              <Text style={styles.listSub} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            <TouchableOpacity style={styles.viewAllBtn} onPress={() => router.push("/jobs-list")}>
              <MaterialCommunityIcons name="format-list-bulleted" size={16} color="#16a34a" />
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <JobDetailCard job={item} onPress={() => router.push(`/jobs/${item.id}`)} />
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color="#16a34a" style={{ marginVertical: 24 }} />
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="briefcase-search-outline" size={40} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No jobs found</Text>
              <Text style={styles.emptySub}>Try another city or clear your filters.</Text>
            </View>
          )
        }
        ListFooterComponent={
          !loading && total > jobs.length ? (
            <TouchableOpacity style={styles.seeAllBtn} onPress={() => router.push("/jobs-list")}>
              <Text style={styles.seeAllText}>See all {total} jobs</Text>
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
}: {
  visible: boolean;
  value: SheetFilters;
  onClose: () => void;
  onApply: (f: SheetFilters) => void;
}) {
  const categories = useMemo(() => getAllCategories(), []);
  const [categoryId, setCategoryId] = useState<string | undefined>(value.categoryId);
  const [minBudget, setMinBudget] = useState(value.minBudget ? String(value.minBudget) : "");
  const [maxBudget, setMaxBudget] = useState(value.maxBudget ? String(value.maxBudget) : "");
  const [duration, setDuration] = useState<JobDuration | undefined>(value.duration);

  // Re-seed the draft from applied values each time the sheet opens
  useEffect(() => {
    if (!visible) return;
    setCategoryId(value.categoryId);
    setMinBudget(value.minBudget ? String(value.minBudget) : "");
    setMaxBudget(value.maxBudget ? String(value.maxBudget) : "");
    setDuration(value.duration);
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

          <Text style={styles.sheetLabel}>Budget (Rs.)</Text>
          <View style={styles.wageRow}>
            <TextInput
              style={styles.wageInput}
              placeholder="Min"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              value={minBudget}
              onChangeText={setMinBudget}
            />
            <Text style={{ color: "#94a3b8" }}>–</Text>
            <TextInput
              style={styles.wageInput}
              placeholder="Max"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              value={maxBudget}
              onChangeText={setMaxBudget}
            />
          </View>

          <Text style={[styles.sheetLabel, { marginTop: 18 }]}>Duration</Text>
          <View style={styles.sheetChips}>
            {DURATIONS.map((d) => {
              const active = duration === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[styles.sheetChip, active && styles.sheetChipActive]}
                  onPress={() => setDuration(active ? undefined : d)}
                >
                  <Text style={[styles.sheetChipText, active && styles.sheetChipTextActive]}>
                    {DURATION_LABELS[d]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.sheetActions}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => {
              setCategoryId(undefined);
              setMinBudget("");
              setMaxBudget("");
              setDuration(undefined);
              onApply({});
            }}
          >
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() =>
              onApply({ categoryId, minBudget: toNum(minBudget), maxBudget: toNum(maxBudget), duration })
            }
          >
            <Text style={styles.applyText}>Apply filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles (kept identical to the Workers tab) ───────────────────────────────

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
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
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
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
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
