import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { notificationsApi, type InboxFilter, type InboxNotification } from "@/lib/api";
import { routeForNotification } from "@/lib/push";
import { useAuthStore } from "@/store/authStore";
import { BackButton } from "@/components/BackButton";

const TABS: { key: InboxFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "jobs", label: "Jobs" },
  { key: "messages", label: "Messages" },
];

const CATEGORY_STYLE: Record<
  InboxNotification["category"],
  { icon: string; bg: string }
> = {
  applications: { icon: "check-bold", bg: "#22c55e" },
  chat: { icon: "chat-processing", bg: "#3b82f6" },
  review: { icon: "shield-check", bg: "#f59e0b" },
  newJobs: { icon: "briefcase-plus", bg: "#3b82f6" },
};

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function NotificationsScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [tab, setTab] = useState<InboxFilter>("all");
  const [items, setItems] = useState<InboxNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (which: InboxFilter, silent = false) => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }
      if (!silent) setLoading(true);
      setError("");
      try {
        const page = await notificationsApi.list({ type: which });
        setItems(page.items);
        setCursor(page.nextCursor);
        setUnread(page.unreadCount);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Could not load notifications");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated],
  );

  useFocusEffect(
    useCallback(() => {
      load(tab, items.length > 0);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, tab]),
  );

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await notificationsApi.list({ type: tab, cursor });
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      // keep what we have; the user can pull to refresh
    } finally {
      setLoadingMore(false);
    }
  }

  async function markAllRead() {
    if (unread === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.readAt ? n : { ...n, readAt: now })));
    setUnread(0);
    notificationsApi.markAllRead().catch(() => load(tab, true));
  }

  function open(n: InboxNotification) {
    if (!n.readAt) {
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
      );
      setUnread((u) => Math.max(0, u - 1));
      notificationsApi.markRead(n.id).catch(() => {});
    }
    const route = routeForNotification(n.data ?? undefined);
    if (route) router.push(route.pathname as never);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <BackButton />
          <Text style={styles.title}>Notifications</Text>
        </View>
        {isAuthenticated && (
          <TouchableOpacity onPress={markAllRead} disabled={unread === 0} hitSlop={8}>
            <Text style={[styles.markAll, unread === 0 && { opacity: 0.4 }]}>Mark all read</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => {
                if (t.key === tab) return;
                setItems([]);
                setTab(t.key);
              }}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!isAuthenticated ? (
        <Empty
          icon="bell-outline"
          title="Log in to see notifications"
          desc="Job updates and messages will show up here."
          action={{ label: "Log in", onPress: () => router.push("/auth") }}
        />
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : error ? (
        <Empty
          icon="wifi-off"
          title="Couldn't load notifications"
          desc={error}
          action={{ label: "Retry", onPress: () => load(tab) }}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(tab, true);
              }}
              tintColor="#16a34a"
            />
          }
          renderItem={({ item }) => {
            const style = CATEGORY_STYLE[item.category] ?? CATEGORY_STYLE.newJobs;
            const isUnread = !item.readAt;
            return (
              <TouchableOpacity
                style={[styles.row, isUnread && styles.rowUnread]}
                onPress={() => open(item)}
                activeOpacity={0.7}
              >
                <View style={[styles.icon, { backgroundColor: style.bg }]}>
                  <MaterialCommunityIcons name={style.icon} size={22} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.rowBody} numberOfLines={2}>
                    {item.body}
                  </Text>
                </View>
                <View style={styles.meta}>
                  <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
                  {isUnread && <View style={styles.dot} />}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <Empty
              icon="bell-check-outline"
              title="You're all caught up"
              desc={
                tab === "messages"
                  ? "New messages will appear here."
                  : tab === "jobs"
                    ? "Job applications and updates will appear here."
                    : "Job updates and messages will appear here."
              }
            />
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color="#16a34a" style={{ marginVertical: 16 }} /> : null
          }
          contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

function Empty({
  icon,
  title,
  desc,
  action,
}: {
  icon: string;
  title: string;
  desc: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name={icon} size={34} color="#16a34a" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
      {action && (
        <TouchableOpacity style={styles.emptyBtn} onPress={action.onPress}>
          <Text style={styles.emptyBtnText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 24, fontWeight: "800", color: "#0f172a" },
  markAll: { fontSize: 14, fontWeight: "700", color: "#16a34a" },

  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 4,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
  },
  tab: { flex: 1, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  tabActive: { backgroundColor: "#16a34a" },
  tabText: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  tabTextActive: { color: "#fff" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingLeft: 16,
    paddingRight: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    borderLeftWidth: 4,
    borderLeftColor: "transparent",
  },
  rowUnread: { borderLeftColor: "#16a34a" },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: { fontSize: 15, fontWeight: "700", color: "#0f172a" },
  rowBody: { fontSize: 13.5, color: "#475569", marginTop: 3, lineHeight: 19 },
  meta: { alignItems: "flex-end", alignSelf: "stretch", justifyContent: "space-between", paddingVertical: 2 },
  time: { fontSize: 12.5, color: "#64748b" },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#16a34a" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 60 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", marginTop: 14 },
  emptyDesc: { fontSize: 13.5, color: "#64748b", textAlign: "center", lineHeight: 20, marginTop: 6 },
  emptyBtn: {
    marginTop: 18,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
