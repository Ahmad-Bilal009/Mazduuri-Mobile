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
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setStatusBarStyle } from "expo-status-bar";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import * as Location from "expo-location";
import { workersApi, chatApi, notificationsApi } from "@/lib/api";
import { getAllCategories, getCategory, type Category } from "@/lib/categories";
import { categoryIcon } from "@/lib/categoryIcons";
import { CategoryIcon } from "@/components/CategoryIcon";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { useAuthGate } from "@/hooks/useAuthGate";
import type { WorkerProfile } from "@/types";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const GREEN = "#16a34a";
const GREEN_BRIGHT = "#22c55e";
const GREEN_DEEP = "#0b3d22";
const GREEN_TINT = "#dcfce7";
const MINT = "#bbf7d0";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e8edf3";
const BG = "#f6f8fa";
const ORANGE = "#f97316";

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

/** The eight services on the Home grid; the rest live behind "See all". */
const POPULAR = [
  "electrical",
  "plumbing",
  "carpentry_wood",
  "painting_finishing",
  "hvac_cooling",
  "construction_building",
  "cleaning",
  "vehicle_services",
];

/** Short labels so the 4-column grid never wraps awkwardly. */
const SHORT_LABEL: Record<string, string> = {
  electrical: "Electrician",
  plumbing: "Plumber",
  carpentry_wood: "Carpenter",
  painting_finishing: "Painter",
  hvac_cooling: "AC Repair",
  construction_building: "Mason",
  cleaning: "Cleaning",
  vehicle_services: "Mechanic",
};

const STEPS = [
  { title: "Search", desc: "Pick a service and city to see verified pros near you." },
  { title: "Compare", desc: "Check ratings, experience and daily rates side by side." },
  { title: "Hire", desc: "Chat in the app, agree on the work, and pay the worker directly." },
];

const WHY = [
  { icon: "shield-check-outline", title: "Verified", desc: "ID and selfie checked" },
  { icon: "flash-outline", title: "Fast hiring", desc: "Message a pro in minutes" },
  { icon: "cash-multiple", title: "Clear prices", desc: "Daily rates shown up front" },
  { icon: "map-marker-radius-outline", title: "Nearby", desc: "Help around the corner" },
  { icon: "chat-processing-outline", title: "In-app chat", desc: "Voice notes and location" },
  { icon: "star-outline", title: "Real reviews", desc: "Rated by real clients" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Coords = { latitude: number; longitude: number };

function distanceKm(a: Coords, b: Coords) {
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

function tradeOf(w: WorkerProfile) {
  const id = w.categoryIds?.[0];
  return id ? shortName(getCategory(id)?.name ?? "") : "";
}

function avatarColor(name: string) {
  const colors = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
  return colors[(name.charCodeAt(0) || 0) % colors.length];
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
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

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { gate } = useAuthGate();
  const { isAuthenticated, user } = useAuthStore();

  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [areaLabel, setAreaLabel] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [city, setCity] = useState<string | undefined>();
  const [picker, setPicker] = useState<null | "category" | "city" | "services">(null);
  const [chatting, setChatting] = useState<string | null>(null);

  const categories = useMemo(() => getAllCategories(), []);
  const popular = useMemo(
    () => POPULAR.map((id) => categories.find((c) => c.id === id)).filter((c): c is Category => !!c),
    [categories],
  );

  // The header is dark green, so the status bar needs light content — but
  // only while this tab is in view; every other screen is light.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      notificationsApi
        .list()
        .then((p) => setUnread(p.unreadCount))
        .catch(() => {});
    }, [isAuthenticated]),
  );

  const load = useCallback(async () => {
    try {
      const res = await workersApi.list({ page: 1, limit: 30 });
      setWorkers(res.data);
      setTotal(res.total);
    } catch {
      // Home still works without live data; the workers row shows its empty state.
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
        const label = [place?.district ?? place?.street, place?.city ?? place?.subregion]
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
      .slice(0, 8)
      .map((w) => ({
        ...w,
        distance:
          coords && w.latitude && w.longitude
            ? distanceKm(coords, { latitude: w.latitude, longitude: w.longitude })
            : undefined,
      }));
  }, [workers, coords]);

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
          `We couldn't find a service matching "${query.trim()}". Try picking a category instead.`,
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
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const isWorker = user?.role === "worker";
  const place = areaLabel ?? city ?? "Pakistan";

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#fff"
          />
        }
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <View style={styles.ringLarge} />
          <View style={styles.ringSmall} />

          <View style={styles.topRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>
                {greeting()}
                {firstName ? `, ${firstName}` : ""} 👋
              </Text>
              <TouchableOpacity style={styles.placeRow} onPress={() => setPicker("city")} activeOpacity={0.7}>
                <MaterialCommunityIcons name="map-marker" size={16} color={MINT} />
                <Text style={styles.placeText} numberOfLines={1}>
                  {place}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={18} color={MINT} />
              </TouchableOpacity>
            </View>

            {isAuthenticated ? (
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/notifications")} activeOpacity={0.8}>
                <MaterialCommunityIcons name="bell-outline" size={22} color="#fff" />
                {unread > 0 && (
                  <View style={styles.dot}>
                    <Text style={styles.dotText}>{unread > 9 ? "9+" : unread}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.loginPill} onPress={() => router.push("/auth")} activeOpacity={0.85}>
                <Text style={styles.loginText}>Log in</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.title}>
            Find skilled workers{"\n"}
            <Text style={{ color: MINT }}>near you</Text>
          </Text>

          <View style={styles.search}>
            <MaterialCommunityIcons name="magnify" size={22} color={MUTED} />
            <TextInput
              style={styles.searchInput}
              placeholder="Plumber, electrician, painter…"
              placeholderTextColor="#94a3b8"
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={runSearch}
            />
            <TouchableOpacity style={styles.searchGo} onPress={runSearch} activeOpacity={0.85}>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterRow}>
            <TouchableOpacity style={styles.filterPill} onPress={() => setPicker("category")} activeOpacity={0.8}>
              <MaterialCommunityIcons
                name={selectedCategory ? categoryIcon(selectedCategory.id) : "view-grid-outline"}
                size={16}
                color="#fff"
              />
              <Text style={styles.filterText} numberOfLines={1}>
                {selectedCategory ? shortName(selectedCategory.name) : "Any service"}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color={MINT} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.filterPill} onPress={() => setPicker("city")} activeOpacity={0.8}>
              <MaterialCommunityIcons name="city-variant-outline" size={16} color="#fff" />
              <Text style={styles.filterText} numberOfLines={1}>
                {city ?? "Any city"}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color={MINT} />
            </TouchableOpacity>
          </View>

          <View style={styles.stats}>
            {/* A bare "0" undersells a new marketplace; show what is always true instead. */}
            {total ? (
              <Stat value={total.toLocaleString()} label="Verified workers" />
            ) : (
              <Stat value="100%" label="ID verified" />
            )}
            <View style={styles.statDivider} />
            <Stat value={`${categories.length}`} label="Services" />
            <View style={styles.statDivider} />
            <Stat value="Free" label="To join" />
          </View>
        </View>

        {/* ── Body sheet ── */}
        <View style={[styles.body, styles.sheetTop]}>
          {/* Services */}
          <SectionHeader title="Browse by service" action="See all" onAction={() => setPicker("services")} />
          <View style={styles.grid}>
            {popular.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.gridItem}
                onPress={() => openList({ categoryId: c.id, city })}
                activeOpacity={0.75}
              >
                <CategoryIcon id={c.id} size={56} />
                <Text style={styles.gridLabel} numberOfLines={1}>
                  {SHORT_LABEL[c.id] ?? shortName(c.name)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Join banner */}
          <TouchableOpacity style={styles.banner} onPress={becomeWorker} activeOpacity={0.9}>
            <View style={styles.bannerIcon}>
              <MaterialCommunityIcons name={isWorker ? "account-edit-outline" : "account-hard-hat"} size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>{isWorker ? "Keep your profile fresh" : "Are you a skilled worker?"}</Text>
              <Text style={styles.bannerSub}>
                {isWorker
                  ? "Update your rate, skills and availability to get more calls."
                  : "Create a free profile and get hired by clients near you."}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color={ORANGE} />
          </TouchableOpacity>

          {/* Top-rated workers */}
          <SectionHeader
            title="Top-rated pros"
            subtitle="Highest-rated verified workers"
            action="See all"
            onAction={() => router.push("/workers-list")}
          />
        </View>

        {loading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {[0, 1].map((i) => (
              <View key={i} style={[styles.proCard, styles.skeleton]}>
                <View style={styles.skelRow}>
                  <View style={styles.skelAvatar} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <View style={[styles.skelLine, { width: "70%" }]} />
                    <View style={[styles.skelLine, { width: "45%" }]} />
                  </View>
                </View>
                <View style={[styles.skelLine, { width: "90%", marginTop: 18 }]} />
                <View style={[styles.skelLine, { width: "60%", marginTop: 10 }]} />
              </View>
            ))}
          </ScrollView>
        ) : topWorkers.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <MaterialCommunityIcons name="account-search-outline" size={28} color={GREEN} />
            </View>
            <Text style={styles.emptyTitle}>No workers listed yet</Text>
            <Text style={styles.emptySub}>
              New pros are joining every day. Check back soon{isWorker ? "." : ", or be the first in your area."}
            </Text>
            {!isWorker && (
              <TouchableOpacity style={styles.emptyBtn} onPress={becomeWorker} activeOpacity={0.85}>
                <Text style={styles.emptyBtnText}>Join as a worker</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            decelerationRate="fast"
            snapToInterval={CARD_W + 12}
            snapToAlignment="start"
          >
            {topWorkers.map((w) => (
              <TouchableOpacity
                key={w.id}
                style={styles.proCard}
                onPress={() => router.push(`/workers/${w.id}`)}
                activeOpacity={0.92}
              >
                <View style={styles.proTop}>
                  <View>
                    <View style={[styles.avatar, { backgroundColor: avatarColor(w.name) }]}>
                      {w.profilePicture ? (
                        <Image source={{ uri: w.profilePicture }} style={styles.avatarImg} />
                      ) : (
                        <Text style={styles.avatarInitial}>{w.name[0]?.toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.verified}>
                      <MaterialCommunityIcons name="check-decagram" size={14} color={GREEN_BRIGHT} />
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.proName} numberOfLines={1}>
                      {w.name}
                    </Text>
                    <Text style={styles.proTrade} numberOfLines={1}>
                      {tradeOf(w) || "Skilled worker"}
                    </Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: w.availability ? GREEN_BRIGHT : "#cbd5e1" }]} />
                </View>

                <View style={styles.metaRow}>
                  <Meta icon="star" color="#f59e0b" text={(w.rating ?? 0) > 0 ? w.rating.toFixed(1) : "New"} />
                  <Meta icon="briefcase-outline" text={`${w.experience ?? 0} yrs`} />
                  <Meta
                    icon="map-marker-outline"
                    text={w.distance !== undefined ? `${w.distance.toFixed(1)} km` : w.city ?? "—"}
                  />
                </View>

                <View style={styles.proBottom}>
                  <View>
                    <Text style={styles.price}>{formatCurrency(w.dailyWage)}</Text>
                    <Text style={styles.priceUnit}>per day</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.hireBtn}
                    onPress={() => hire(w)}
                    disabled={chatting === w.id}
                    activeOpacity={0.85}
                  >
                    {chatting === w.id ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="message-text-outline" size={16} color="#fff" />
                        <Text style={styles.hireText}>Hire</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View style={styles.body}>
          {/* How it works */}
          <SectionHeader title="How it works" />
          <View style={styles.card}>
            {STEPS.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <View style={styles.stepRail}>
                  <View style={styles.stepNum}>
                    <Text style={styles.stepNumText}>{i + 1}</Text>
                  </View>
                  {i < STEPS.length - 1 && <View style={styles.stepLine} />}
                </View>
                <View style={[styles.stepBody, i === STEPS.length - 1 && { paddingBottom: 0 }]}>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                  <Text style={styles.stepDesc}>{s.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Why Mazduuri */}
          <View style={styles.why}>
            <Text style={styles.whyEyebrow}>WHY MAZDUURI</Text>
            <Text style={styles.whyTitle}>Built for trust & speed</Text>
            <View style={styles.whyGrid}>
              {WHY.map((f) => (
                <View key={f.title} style={styles.whyItem}>
                  <View style={styles.whyIcon}>
                    <MaterialCommunityIcons name={f.icon} size={20} color={MINT} />
                  </View>
                  <Text style={styles.whyItemTitle}>{f.title}</Text>
                  <Text style={styles.whyItemDesc}>{f.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Keeps the status bar legible once the white body scrolls under it. */}
      <View pointerEvents="none" style={[styles.statusBg, { height: insets.top }]} />

      {/* ── Sheets ── */}
      <PickerSheet
        visible={picker === "category"}
        title="Choose a service"
        options={categories.map((c) => ({ value: c.id, label: shortName(c.name), icon: categoryIcon(c.id), categoryId: c.id }))}
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
      <ServicesSheet
        visible={picker === "services"}
        categories={categories}
        onPick={(id) => {
          setPicker(null);
          openList({ categoryId: id, city });
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

// ─── Pieces ───────────────────────────────────────────────────────────────────

const CARD_W = 280;

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHead}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
      </View>
      {action ? (
        <TouchableOpacity onPress={onAction} hitSlop={10} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{action}</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={GREEN} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function Meta({ icon, text, color = MUTED }: { icon: string; text: string; color?: string }) {
  return (
    <View style={styles.meta}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <Text style={styles.metaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function ServicesSheet({
  visible,
  categories,
  onPick,
  onClose,
}: {
  visible: boolean;
  categories: Category[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={[styles.sheet, { maxHeight: "82%" }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>All services</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <MaterialCommunityIcons name="close" size={22} color={INK} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={categories}
          keyExtractor={(c) => c.id}
          numColumns={3}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ gap: 10, paddingBottom: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.allItem} onPress={() => onPick(item.id)} activeOpacity={0.75}>
              <CategoryIcon id={item.id} size={50} />
              <Text style={styles.allLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
                {shortName(item.name)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
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
  options: { value: string; label: string; icon: string; categoryId?: string }[];
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
                {item.categoryId ? (
                  <CategoryIcon id={item.categoryId} size={36} />
                ) : (
                  <MaterialCommunityIcons name={item.icon} size={20} color={active ? GREEN : MUTED} />
                )}
                <Text style={[styles.sheetRowText, active && { color: GREEN, fontWeight: "700" }]}>{item.label}</Text>
                {active && <MaterialCommunityIcons name="check" size={20} color={GREEN} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const shadow = {
  shadowColor: "#0f172a",
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  // Header
  header: {
    backgroundColor: GREEN_DEEP,
    paddingHorizontal: 20,
    paddingBottom: 48,
    overflow: "hidden",
  },
  ringLarge: {
    position: "absolute",
    top: -90,
    right: -110,
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 46,
    borderColor: "rgba(34,197,94,0.12)",
  },
  ringSmall: {
    position: "absolute",
    bottom: -60,
    left: -50,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(34,197,94,0.08)",
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  hello: { fontSize: 14, color: "rgba(255,255,255,0.75)", fontWeight: "500" },
  placeRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3, alignSelf: "flex-start", maxWidth: "100%" },
  placeText: { fontSize: 16, fontWeight: "700", color: "#fff", flexShrink: 1 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    position: "absolute",
    top: 6,
    right: 5,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: ORANGE,
    borderWidth: 2,
    borderColor: GREEN_DEEP,
    alignItems: "center",
    justifyContent: "center",
  },
  dotText: { fontSize: 9, fontWeight: "800", color: "#fff" },
  loginPill: { paddingHorizontal: 16, height: 38, borderRadius: 19, backgroundColor: "#fff", justifyContent: "center" },
  loginText: { fontSize: 14, fontWeight: "700", color: GREEN_DEEP },

  title: { fontSize: 30, lineHeight: 36, fontWeight: "800", color: "#fff", marginTop: 22, letterSpacing: -0.6 },

  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 56,
    marginTop: 20,
    paddingLeft: 16,
    paddingRight: 6,
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  searchInput: { flex: 1, fontSize: 15.5, color: INK, paddingVertical: 0 },
  searchGo: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: GREEN_BRIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  filterRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  filterPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  filterText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#fff" },

  stats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  statDivider: { width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.15)" },
  statValue: { fontSize: 18, fontWeight: "800", color: "#fff" },
  statLabel: { fontSize: 11.5, color: "rgba(255,255,255,0.65)", marginTop: 1 },

  // Body
  body: { paddingHorizontal: 20 },
  sheetTop: {
    marginTop: -24,
    paddingTop: 2,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: BG,
  },
  statusBg: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: GREEN_DEEP },
  sectionHead: { flexDirection: "row", alignItems: "flex-end", marginTop: 26, marginBottom: 14 },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: INK, letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, color: MUTED, marginTop: 2 },
  sectionAction: { flexDirection: "row", alignItems: "center" },
  sectionActionText: { fontSize: 14, fontWeight: "700", color: GREEN },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 16,
    paddingTop: 18,
    paddingBottom: 18,
    borderRadius: 24,
    backgroundColor: "#fff",
    ...shadow,
  },
  gridItem: { width: "25%", alignItems: "center", gap: 8 },
  gridLabel: { fontSize: 12.5, fontWeight: "600", color: INK },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 18,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerTitle: { fontSize: 15.5, fontWeight: "800", color: INK },
  bannerSub: { fontSize: 13, lineHeight: 18, color: "#7c4a1e", marginTop: 2 },

  // Worker rail
  rail: { paddingHorizontal: 20, gap: 12, paddingBottom: 6 },
  proCard: {
    width: CARD_W,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: LINE,
    ...shadow,
  },
  proTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImg: { width: 52, height: 52 },
  avatarInitial: { color: "#fff", fontSize: 21, fontWeight: "800" },
  verified: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  proName: { fontSize: 16.5, fontWeight: "800", color: INK },
  proTrade: { fontSize: 13, color: MUTED, marginTop: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, alignSelf: "flex-start", marginTop: 4 },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    maxWidth: 110,
  },
  metaText: { fontSize: 12.5, fontWeight: "600", color: "#334155" },
  proBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  price: { fontSize: 17, fontWeight: "800", color: INK },
  priceUnit: { fontSize: 12, color: MUTED },
  hireBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 40,
    minWidth: 86,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: GREEN,
    justifyContent: "center",
  },
  hireText: { fontSize: 14.5, fontWeight: "700", color: "#fff" },

  skeleton: { height: 168 },
  skelRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  skelAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#eef2f6" },
  skelLine: { height: 12, borderRadius: 6, backgroundColor: "#eef2f6" },

  empty: {
    marginHorizontal: 20,
    alignItems: "center",
    paddingVertical: 26,
    paddingHorizontal: 24,
    borderRadius: 22,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: LINE,
    borderStyle: "dashed",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: GREEN_TINT,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", color: INK, marginTop: 12 },
  emptySub: { fontSize: 13.5, lineHeight: 19, color: MUTED, textAlign: "center", marginTop: 4 },
  emptyBtn: { marginTop: 14, paddingHorizontal: 18, height: 40, borderRadius: 12, backgroundColor: GREEN, justifyContent: "center" },
  emptyBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // How it works
  card: { padding: 18, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: LINE },
  step: { flexDirection: "row", gap: 14 },
  stepRail: { alignItems: "center", width: 32 },
  stepNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  stepLine: { flex: 1, width: 2, marginVertical: 4, backgroundColor: GREEN_TINT },
  stepBody: { flex: 1, paddingBottom: 18, paddingTop: 4 },
  stepTitle: { fontSize: 15.5, fontWeight: "800", color: INK },
  stepDesc: { fontSize: 13.5, lineHeight: 19, color: MUTED, marginTop: 3 },

  // Why
  why: { marginTop: 28, padding: 20, borderRadius: 24, backgroundColor: GREEN_DEEP, overflow: "hidden" },
  whyEyebrow: { fontSize: 11.5, fontWeight: "800", letterSpacing: 1.2, color: GREEN_BRIGHT },
  whyTitle: { fontSize: 21, fontWeight: "800", color: "#fff", marginTop: 4, letterSpacing: -0.3 },
  whyGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 16, rowGap: 18 },
  whyItem: { width: "50%", paddingRight: 10 },
  whyIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(34,197,94,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  whyItemTitle: { fontSize: 14.5, fontWeight: "700", color: "#fff" },
  whyItemDesc: { fontSize: 12.5, color: "rgba(255,255,255,0.6)", marginTop: 2 },

  // Sheets
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)" },
  sheet: {
    maxHeight: "70%",
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: LINE, marginTop: 10 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: INK },
  sheetClear: { fontSize: 14, fontWeight: "700", color: GREEN },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sheetRowText: { flex: 1, fontSize: 15, color: INK },
  allItem: {
    flex: 1 / 3,
    alignItems: "center",
    gap: 10,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 6,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eef2f6",
  },
  allLabel: { fontSize: 12.5, lineHeight: 16, fontWeight: "600", color: INK, textAlign: "center" },
});
