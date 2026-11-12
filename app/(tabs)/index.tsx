import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import * as Location from "expo-location";
import { workersApi, chatApi } from "@/lib/api";
import { getAllCategories, getCategory, type Category } from "@/lib/categories";
import { categoryIcon } from "@/lib/categoryIcons";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useAuthGate } from "@/hooks/useAuthGate";
import type { WorkerProfile } from "@/types";

// ─── Static content ───────────────────────────────────────────────────────────

const GREEN = "#22c55e";
const GREEN_DARK = "#16a34a";
const INK = "#0f172a";
const MUTED = "#475569";
const BORDER = "#e2e8f0";

const CITIES = [
  "Lahore",
  "Karachi",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Multan",
  "Peshawar",
  "Quetta",
  "Sialkot",
  "Gujranwala",
  "Hyderabad",
  "Bahawalpur",
  "Sargodha",
  "Abbottabad",
  "Sukkur",
];

/** Shown first under "Browse by service"; the rest appear on "See all". */
const POPULAR = [
  "electrical",
  "plumbing",
  "carpentry_wood",
  "painting_finishing",
  "construction_building",
  "hvac_cooling",
  "vehicle_services",
  "metal_welding",
  "cleaning",
  "drivers",
  "general_labour",
  "electronics_repair",
];

const STEPS = [
  {
    icon: "magnify",
    title: "Search Workers",
    desc: "Pick a service, choose your city, and browse verified pros in seconds.",
  },
  {
    icon: "account-group-outline",
    title: "Compare Profiles",
    desc: "Check reviews, daily rates, and experience side by side to find the right fit.",
  },
  {
    icon: "shield-check-outline",
    title: "Hire with Confidence",
    desc: "Chat in the app, agree on the work, and pay the worker directly.",
  },
];

const WHY = [
  { icon: "shield-check-outline", title: "Verified Workers", desc: "ID and selfie checked by our team" },
  { icon: "flash-outline", title: "Fast Hiring", desc: "Message a pro in minutes" },
  { icon: "cash-multiple", title: "Affordable Prices", desc: "Daily rates shown up front" },
  { icon: "map-marker-outline", title: "Location Based", desc: "Find help right around the corner" },
  { icon: "chat-processing-outline", title: "Secure Chat", desc: "Messages, voice notes and location" },
  { icon: "thumb-up-outline", title: "Trusted Reviews", desc: "Real ratings from real clients" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude * Math.PI) / 180) * Math.cos((b.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function shortName(name: string) {
  return name.replace(/\s*\(.*?\)\s*/g, "").trim();
}

function categoryBlurb(c: Category) {
  return c.subcategories
    .slice(0, 2)
    .map((s) => shortName(s.name))
    .join(", ");
}

function tradeOf(w: WorkerProfile) {
  const id = w.categoryIds?.[0];
  return id ? shortName(getCategory(id)?.name ?? "") : "";
}

function avatarColor(name: string) {
  const colors = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
  return colors[name.charCodeAt(0) % colors.length];
}

/** Matches free text ("plumber", "tile") to a category or sub-service. */
function matchService(query: string, within?: string) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const cats = getAllCategories().filter((c) => !within || c.id === within);
  for (const c of cats) {
    const sub = c.subcategories.find((s) => s.name.toLowerCase().includes(q));
    if (sub) return { categoryId: c.id, subcategoryId: sub.id };
  }
  const stem = q.replace(/(er|ers|ing|s)$/, "");
  for (const c of cats) {
    if (c.name.toLowerCase().includes(q) || (stem.length >= 3 && c.name.toLowerCase().includes(stem))) {
      return { categoryId: c.id };
    }
  }
  return null;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

type Coords = { latitude: number; longitude: number };

export default function HomeScreen() {
  const router = useRouter();
  const { gate } = useAuthGate();
  const { isAuthenticated, user } = useAuthStore();

  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [areaLabel, setAreaLabel] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [city, setCity] = useState<string | undefined>();
  const [picker, setPicker] = useState<null | "category" | "city">(null);
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [chatting, setChatting] = useState<string | null>(null);

  const categories = useMemo(() => getAllCategories(), []);
  const gridCategories = useMemo(
    () =>
      showAllCategories
        ? categories
        : POPULAR.map((id) => categories.find((c) => c.id === id)).filter((c): c is Category => !!c),
    [categories, showAllCategories],
  );

  const load = useCallback(async () => {
    try {
      const res = await workersApi.list({ page: 1, limit: 30 });
      setWorkers(res.data);
      setTotal(res.total);
    } catch {
      // Home still works without live data; sections hide themselves.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Location only if already granted — the Home tab never prompts.
  useEffect(() => {
    (async () => {
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (!perm.granted) return;
        const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({}));
        if (!pos) return;
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setCoords(c);
        const [place] = await Location.reverseGeocodeAsync(c);
        const label = [place?.city ?? place?.subregion, place?.district ?? place?.street]
          .filter(Boolean)
          .slice(0, 2)
          .join(", ");
        if (label) setAreaLabel(label);
        if (place?.city && CITIES.includes(place.city)) setCity((prev) => prev ?? place.city ?? undefined);
      } catch {
        // ignore — location is a nice-to-have here
      }
    })();
  }, []);

  const topWorkers = useMemo(() => {
    return [...workers]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.totalJobs ?? 0) - (a.totalJobs ?? 0))
      .slice(0, 4)
      .map((w) => ({
        ...w,
        distance:
          coords && w.latitude && w.longitude
            ? distanceKm(coords, { latitude: w.latitude, longitude: w.longitude })
            : undefined,
      }));
  }, [workers, coords]);

  const nearbyCount = useMemo(() => {
    if (!coords) return null;
    return workers.filter(
      (w) => w.latitude && w.longitude && distanceKm(coords, { latitude: w.latitude, longitude: w.longitude }) <= 10,
    ).length;
  }, [workers, coords]);

  const spotlight = topWorkers.find((w) => (w.rating ?? 0) > 0) ?? topWorkers[0];

  // ─── Actions ────────────────────────────────────────────────────────────────

  function openList(params: { city?: string; categoryId?: string; subcategoryId?: string }) {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => !!v)) as Record<string, string>;
    router.push({ pathname: "/workers-list", params: clean });
  }

  function runSearch() {
    let match: { categoryId?: string; subcategoryId?: string } | null = categoryId ? { categoryId } : null;
    if (query.trim()) {
      const found = matchService(query, categoryId);
      if (!found) {
        Alert.alert(
          "No matching service",
          `We couldn't find a service matching "${query.trim()}". Try a category from the list instead.`,
        );
        return;
      }
      match = found;
    }
    openList({ city, ...match });
  }

  function becomeWorker() {
    if (!isAuthenticated || !user) {
      router.push({ pathname: "/auth", params: { mode: "signup", role: "worker" } });
    } else if (user.role === "worker") {
      router.push("/profile/edit-worker");
    } else {
      // Clients switch account type from Settings.
      router.push("/settings");
    }
  }

  function hire(w: WorkerProfile) {
    gate(async () => {
      const workerUserId = w.userId ?? w.user?.id;
      if (!workerUserId) return router.push(`/workers/${w.id}`);
      setChatting(w.id);
      try {
        const conv = await chatApi.start(workerUserId);
        router.push(`/chat/${conv.id}`);
      } catch (e: unknown) {
        Alert.alert("Error", e instanceof Error ? e.message : "Could not open chat");
      } finally {
        setChatting(null);
      }
    }, "contact this worker");
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const selectedCategory = categoryId ? getCategory(categoryId) : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={GREEN_DARK}
          />
        }
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.blobTop} />
          <View style={styles.badge}>
            <MaterialCommunityIcons name="shield-check-outline" size={15} color={GREEN_DARK} />
            <Text style={styles.badgeText}>Verified workers across Pakistan</Text>
          </View>

          <Text style={styles.heroTitle}>
            Find Skilled Workers{"\n"}
            <Text style={{ color: GREEN }}>Near You</Text>
          </Text>
          <Text style={styles.heroSub}>
            Connect with verified electricians, plumbers, painters, carpenters, AC technicians,
            mechanics, cleaners, masons and more.
          </Text>

          <View style={styles.heroBtns}>
            <TouchableOpacity style={styles.heroPrimary} onPress={() => router.push("/(tabs)/workers")} activeOpacity={0.85}>
              <Text style={styles.heroPrimaryText}>Find Workers</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroSecondary} onPress={becomeWorker} activeOpacity={0.85}>
              <Text style={styles.heroSecondaryText}>
                {user?.role === "worker" ? "My Worker Profile" : "Become a Worker"}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.stats}>
            <Stat value={total === null ? "—" : total.toLocaleString()} label="Verified workers" />
            <Stat value={`${categories.length}`} label="Services" />
            <Stat value="Free" label="To browse & join" />
          </View>

          {/* Illustration with live chips */}
          <View style={styles.art}>
            <View style={styles.artCircle} />
            <View style={styles.artPeople}>
              {[
                { icon: "account-wrench", bg: "#15803d", size: 70 },
                { icon: "account-hard-hat", bg: GREEN_DARK, size: 92 },
                { icon: "account-tie", bg: "#166534", size: 70 },
              ].map((p) => (
                <View
                  key={p.icon}
                  style={[styles.artPerson, { width: p.size, height: p.size, borderRadius: p.size / 2, backgroundColor: p.bg }]}
                >
                  <MaterialCommunityIcons name={p.icon} size={p.size * 0.62} color="#fff" />
                </View>
              ))}
            </View>
            <View style={styles.artTools}>
              {["hammer", "pipe-wrench", "format-paint", "lightning-bolt-outline"].map((t) => (
                <View key={t} style={styles.artTool}>
                  <MaterialCommunityIcons name={t} size={18} color={GREEN_DARK} />
                </View>
              ))}
            </View>

            <View style={[styles.chip, styles.chipTopLeft]}>
              <View style={styles.chipIcon}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color={GREEN_DARK} />
              </View>
              <View>
                <Text style={styles.chipTitle} numberOfLines={1}>
                  {areaLabel ?? "Across Pakistan"}
                </Text>
                <Text style={styles.chipSub}>
                  {nearbyCount !== null
                    ? `${nearbyCount} ${nearbyCount === 1 ? "worker" : "workers"} nearby`
                    : `${total ?? "—"} workers listed`}
                </Text>
              </View>
            </View>

            {spotlight && (
              <TouchableOpacity
                style={[styles.chip, styles.chipBottomRight]}
                onPress={() => router.push(`/workers/${spotlight.id}`)}
                activeOpacity={0.85}
              >
                <View style={[styles.chipIcon, { backgroundColor: GREEN }]}>
                  <MaterialCommunityIcons name="star" size={15} color="#fff" />
                </View>
                <View>
                  <Text style={styles.chipTitle} numberOfLines={1}>
                    {(spotlight.rating ?? 0) > 0 ? `${spotlight.rating.toFixed(1)} · ` : ""}
                    {spotlight.name}
                  </Text>
                  <Text style={styles.chipSub} numberOfLines={1}>
                    {[tradeOf(spotlight), `${spotlight.totalJobs ?? 0} jobs`].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Search card ── */}
        <View style={styles.searchCard}>
          <View style={styles.searchField}>
            <MaterialCommunityIcons name="magnify" size={20} color={MUTED} />
            <TextInput
              style={styles.searchInput}
              placeholder="What service do you need?"
              placeholderTextColor="#64748b"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={runSearch}
            />
          </View>
          <TouchableOpacity style={styles.searchField} onPress={() => setPicker("category")} activeOpacity={0.8}>
            <MaterialCommunityIcons name="view-grid-outline" size={19} color={MUTED} />
            <Text style={[styles.selectText, !selectedCategory && styles.selectPlaceholder]} numberOfLines={1}>
              {selectedCategory ? shortName(selectedCategory.name) : "Category"}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={INK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchField} onPress={() => setPicker("city")} activeOpacity={0.8}>
            <MaterialCommunityIcons name="map-marker-outline" size={19} color={MUTED} />
            <Text style={[styles.selectText, !city && styles.selectPlaceholder]}>{city ?? "City"}</Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={INK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.searchBtn} onPress={runSearch} activeOpacity={0.85}>
            <MaterialCommunityIcons name="magnify" size={19} color="#fff" />
            <Text style={styles.searchBtnText}>Search</Text>
          </TouchableOpacity>
        </View>

        {/* ── Categories ── */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>POPULAR CATEGORIES</Text>
          <Text style={styles.sectionTitle}>Browse by service</Text>
          <Text style={styles.sectionSub}>Handpicked professionals across the most requested trades.</Text>

          <View style={styles.grid}>
            {gridCategories.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.catCard}
                onPress={() => openList({ categoryId: c.id, city })}
                activeOpacity={0.85}
              >
                <View style={styles.catIcon}>
                  <MaterialCommunityIcons name={categoryIcon(c.id)} size={22} color={GREEN_DARK} />
                </View>
                <Text style={styles.catName} numberOfLines={2}>
                  {shortName(c.name)}
                </Text>
                <Text style={styles.catSub} numberOfLines={1}>
                  {categoryBlurb(c)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.moreBtn} onPress={() => setShowAllCategories((v) => !v)}>
            <Text style={styles.moreText}>
              {showAllCategories ? "Show fewer services" : `See all ${categories.length} services`}
            </Text>
            <MaterialCommunityIcons name={showAllCategories ? "chevron-up" : "chevron-down"} size={18} color={GREEN_DARK} />
          </TouchableOpacity>
        </View>

        {/* ── Top-rated workers ── */}
        <View style={[styles.section, styles.sectionTinted]}>
          <Text style={[styles.eyebrow, { textAlign: "left" }]}>VERIFIED WORKERS</Text>
          <Text style={[styles.sectionTitle, { textAlign: "left" }]}>Top-rated pros near you</Text>
          <Text style={[styles.sectionSub, { textAlign: "left" }]}>
            Every worker is ID-verified and reviewed by real clients.
          </Text>
          <TouchableOpacity style={styles.inlineLink} onPress={() => router.push("/workers-list")}>
            <Text style={styles.inlineLinkText}>View all workers</Text>
            <MaterialCommunityIcons name="arrow-right" size={17} color={GREEN_DARK} />
          </TouchableOpacity>

          {loading ? (
            <ActivityIndicator color={GREEN_DARK} style={{ marginVertical: 24 }} />
          ) : topWorkers.length === 0 ? (
            <View style={styles.emptyWorkers}>
              <MaterialCommunityIcons name="account-search-outline" size={34} color="#94a3b8" />
              <Text style={styles.emptyWorkersText}>Workers will appear here as they join.</Text>
            </View>
          ) : (
            topWorkers.map((w) => (
              <View key={w.id} style={styles.proCard}>
                <View style={styles.proHeader}>
                  <View>
                    <View style={[styles.proAvatar, { backgroundColor: avatarColor(w.name) }]}>
                      {w.profilePicture ? (
                        <Image source={{ uri: w.profilePicture }} style={styles.proAvatarImg} />
                      ) : (
                        <Text style={styles.proInitial}>{w.name[0]?.toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.proBadge}>
                      <MaterialCommunityIcons name="check-decagram" size={12} color="#fff" />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.proName} numberOfLines={1}>{w.name}</Text>
                    {tradeOf(w) ? <Text style={styles.proTrade}>{tradeOf(w)}</Text> : null}
                    <View style={styles.proRating}>
                      <MaterialCommunityIcons name="star" size={15} color={GREEN} />
                      <Text style={styles.proRatingText}>
                        {(w.rating ?? 0) > 0 ? w.rating.toFixed(1) : "New"}
                      </Text>
                      <Text style={styles.proJobs}>({w.totalJobs ?? 0} jobs)</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.proFacts}>
                  <View style={styles.fact}>
                    <Text style={styles.factLabel}>Experience</Text>
                    <Text style={styles.factValue}>{w.experience ?? 0} yrs</Text>
                  </View>
                  <View style={styles.fact}>
                    <View style={styles.factLabelRow}>
                      <MaterialCommunityIcons name="map-marker-outline" size={13} color={MUTED} />
                      <Text style={styles.factLabel}>{w.distance !== undefined ? "Distance" : "City"}</Text>
                    </View>
                    <Text style={styles.factValue} numberOfLines={1}>
                      {w.distance !== undefined ? `${w.distance.toFixed(1)} km` : w.city ?? "—"}
                    </Text>
                  </View>
                </View>

                <View style={styles.proPriceRow}>
                  <View style={[styles.availPill, !w.availability && styles.busyPill]}>
                    <View style={[styles.availDot, !w.availability && { backgroundColor: "#94a3b8" }]} />
                    <Text style={[styles.availText, !w.availability && { color: MUTED }]}>
                      {w.availability ? "Available now" : "Busy"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.priceLabel}>Starting at</Text>
                    <Text style={styles.priceValue}>{formatCurrency(w.dailyWage)}</Text>
                  </View>
                </View>

                <View style={styles.proBtns}>
                  <TouchableOpacity style={styles.outlineBtn} onPress={() => router.push(`/workers/${w.id}`)}>
                    <Text style={styles.outlineBtnText}>View Profile</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.fillBtn} onPress={() => hire(w)} disabled={chatting === w.id}>
                    {chatting === w.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.fillBtnText}>Hire Now</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* ── How it works ── */}
        <View style={styles.section}>
          <Text style={styles.eyebrow}>HOW IT WORKS</Text>
          <Text style={styles.sectionTitle}>Hire in 3 simple steps</Text>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.stepCard}>
              <Text style={styles.stepNum}>{String(i + 1).padStart(2, "0")}</Text>
              <View style={styles.stepIcon}>
                <MaterialCommunityIcons name={s.icon} size={24} color="#fff" />
              </View>
              <Text style={styles.stepTitle}>{s.title}</Text>
              <Text style={styles.stepDesc}>{s.desc}</Text>
            </View>
          ))}
        </View>

        {/* ── Why Mazduuri ── */}
        <View style={styles.dark}>
          <Text style={[styles.eyebrow, { color: GREEN }]}>WHY MAZDUURI</Text>
          <Text style={[styles.sectionTitle, { color: "#fff" }]}>Built for trust & speed</Text>
          <Text style={[styles.sectionSub, { color: "#94a3b8" }]}>
            Everything you need to hire skilled help with confidence.
          </Text>
          {WHY.map((f) => (
            <View key={f.title} style={styles.whyRow}>
              <View style={styles.whyIcon}>
                <MaterialCommunityIcons name={f.icon} size={21} color={GREEN} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.whyTitle}>{f.title}</Text>
                <Text style={styles.whyDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── Pickers ── */}
      <PickerSheet
        visible={picker === "category"}
        title="Choose a category"
        options={categories.map((c) => ({ value: c.id, label: shortName(c.name), icon: categoryIcon(c.id) }))}
        selected={categoryId}
        onSelect={(v) => {
          setCategoryId(v);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === "city"}
        title="Choose a city"
        options={CITIES.map((c) => ({ value: c, label: c, icon: "map-marker-outline" }))}
        selected={city}
        onSelect={(v) => {
          setCity(v);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PickerSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: string; label: string; icon: string }[];
  selected?: string;
  onSelect: (v: string | undefined) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          {selected ? (
            <TouchableOpacity onPress={() => onSelect(undefined)} hitSlop={8}>
              <Text style={styles.sheetClear}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <FlatList
          data={options}
          keyExtractor={(o) => o.value}
          renderItem={({ item }) => {
            const active = item.value === selected;
            return (
              <TouchableOpacity style={styles.sheetRow} onPress={() => onSelect(item.value)}>
                <MaterialCommunityIcons name={item.icon} size={20} color={active ? GREEN_DARK : MUTED} />
                <Text style={[styles.sheetRowText, active && { color: GREEN_DARK, fontWeight: "700" }]}>
                  {item.label}
                </Text>
                {active && <MaterialCommunityIcons name="check" size={20} color={GREEN_DARK} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },

  hero: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8, backgroundColor: "#f0fdf4", overflow: "hidden" },
  blobTop: {
    position: "absolute",
    top: -120,
    right: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#dcfce7",
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  badgeText: { fontSize: 12.5, fontWeight: "600", color: GREEN_DARK },
  heroTitle: { fontSize: 34, lineHeight: 40, fontWeight: "800", color: INK, marginTop: 16, letterSpacing: -0.5 },
  heroSub: { fontSize: 15.5, lineHeight: 24, color: MUTED, marginTop: 14 },
  heroBtns: { flexDirection: "row", gap: 10, marginTop: 22 },
  heroPrimary: {
    flex: 1,
    height: 50,
    borderRadius: 999,
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: GREEN,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  heroPrimaryText: { color: "#fff", fontSize: 15.5, fontWeight: "700" },
  heroSecondary: {
    flex: 1,
    height: 50,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  heroSecondaryText: { color: INK, fontSize: 15.5, fontWeight: "700" },
  stats: { flexDirection: "row", marginTop: 26 },
  statValue: { fontSize: 24, fontWeight: "800", color: INK },
  statLabel: { fontSize: 12.5, color: MUTED, marginTop: 2 },

  art: { height: 250, marginTop: 18, alignItems: "center", justifyContent: "flex-end" },
  artCircle: {
    position: "absolute",
    bottom: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#dcfce7",
  },
  artPeople: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginBottom: 34 },
  artPerson: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: "#fff",
    shadowColor: "#14532d",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  artTools: { position: "absolute", bottom: 4, flexDirection: "row", gap: 10 },
  artTool: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 14,
    borderRadius: 16,
    backgroundColor: "#fff",
    maxWidth: 220,
    shadowColor: INK,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  chipTopLeft: { top: 6, left: 0 },
  chipBottomRight: { bottom: 40, right: 0 },
  chipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  chipTitle: { fontSize: 13, fontWeight: "700", color: INK, maxWidth: 160 },
  chipSub: { fontSize: 12, color: MUTED, maxWidth: 160 },

  searchCard: {
    marginHorizontal: 16,
    marginTop: -6,
    padding: 12,
    gap: 10,
    borderRadius: 24,
    backgroundColor: "#fff",
    shadowColor: GREEN_DARK,
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  searchField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  searchInput: { flex: 1, fontSize: 15, color: INK, paddingVertical: 0 },
  selectText: { flex: 1, fontSize: 15, color: INK, fontWeight: "500" },
  selectPlaceholder: { color: "#334155" },
  searchBtn: {
    height: 48,
    borderRadius: 999,
    backgroundColor: GREEN,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  searchBtnText: { color: "#fff", fontSize: 15.5, fontWeight: "700" },

  section: { paddingHorizontal: 16, paddingTop: 40, paddingBottom: 8 },
  sectionTinted: { backgroundColor: "#f8fafc", paddingBottom: 24, marginTop: 32 },
  eyebrow: { fontSize: 12.5, fontWeight: "700", color: GREEN_DARK, letterSpacing: 1, textAlign: "center" },
  sectionTitle: { fontSize: 28, fontWeight: "800", color: INK, textAlign: "center", marginTop: 8, letterSpacing: -0.4 },
  sectionSub: { fontSize: 15, lineHeight: 22, color: MUTED, textAlign: "center", marginTop: 8 },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 24, rowGap: 12 },
  catCard: {
    width: "48.5%",
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    minHeight: 132,
  },
  catIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  catName: { fontSize: 16, fontWeight: "700", color: INK },
  catSub: { fontSize: 12.5, color: MUTED, marginTop: 4 },
  moreBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#f0fdf4",
  },
  moreText: { fontSize: 14.5, fontWeight: "700", color: GREEN_DARK },

  inlineLink: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 14, marginBottom: 18 },
  inlineLinkText: { fontSize: 15, fontWeight: "700", color: GREEN_DARK },
  emptyWorkers: { alignItems: "center", gap: 8, paddingVertical: 24 },
  emptyWorkersText: { fontSize: 14, color: MUTED },

  proCard: {
    padding: 16,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eef2f7",
    marginBottom: 14,
    shadowColor: INK,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  proHeader: { flexDirection: "row", gap: 14, alignItems: "center" },
  proAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: "#bbf7d0",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  proAvatarImg: { width: 62, height: 62 },
  proInitial: { color: "#fff", fontSize: 24, fontWeight: "800" },
  proBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GREEN,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  proName: { fontSize: 18, fontWeight: "800", color: INK },
  proTrade: { fontSize: 13.5, color: MUTED, marginTop: 1 },
  proRating: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  proRatingText: { fontSize: 14, fontWeight: "700", color: INK },
  proJobs: { fontSize: 13, color: MUTED },
  proFacts: { flexDirection: "row", gap: 10, marginTop: 14 },
  fact: { flex: 1, padding: 12, borderRadius: 16, backgroundColor: "#f1f5f9" },
  factLabelRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  factLabel: { fontSize: 13, color: MUTED },
  factValue: { fontSize: 14.5, fontWeight: "700", color: INK, marginTop: 3 },
  proPriceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  availPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#dcfce7",
  },
  busyPill: { backgroundColor: "#f1f5f9" },
  availDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: GREEN_DARK },
  availText: { fontSize: 12.5, fontWeight: "600", color: GREEN_DARK },
  priceLabel: { fontSize: 12, color: MUTED },
  priceValue: { fontSize: 17, fontWeight: "800", color: INK },
  proBtns: { flexDirection: "row", gap: 10, marginTop: 14 },
  outlineBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: { fontSize: 14.5, fontWeight: "700", color: INK },
  fillBtn: { flex: 1, height: 44, borderRadius: 999, backgroundColor: GREEN, alignItems: "center", justifyContent: "center" },
  fillBtnText: { fontSize: 14.5, fontWeight: "700", color: "#fff" },

  stepCard: {
    marginTop: 16,
    padding: 22,
    borderRadius: 24,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  stepNum: { position: "absolute", top: 14, right: 20, fontSize: 56, fontWeight: "800", color: "#ecfdf3" },
  stepIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: GREEN,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  stepTitle: { fontSize: 18, fontWeight: "800", color: INK, marginTop: 18 },
  stepDesc: { fontSize: 14.5, lineHeight: 21, color: MUTED, marginTop: 6 },

  dark: { backgroundColor: "#111827", paddingHorizontal: 16, paddingTop: 40, paddingBottom: 40, marginTop: 40 },
  whyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 14,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#1f2937",
    borderWidth: 1,
    borderColor: "#273244",
  },
  whyIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(34,197,94,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  whyTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  whyDesc: { fontSize: 13.5, color: "#94a3b8", marginTop: 3 },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)" },
  sheet: {
    maxHeight: "70%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: BORDER, marginTop: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: INK },
  sheetClear: { fontSize: 14, fontWeight: "700", color: GREEN_DARK },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sheetRowText: { flex: 1, fontSize: 15, color: INK },
});
