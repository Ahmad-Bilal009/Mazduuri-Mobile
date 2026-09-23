import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { chatApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { timeAgo } from "@/lib/utils";
import type { Conversation } from "@/types";
import { BackButton } from "@/components/BackButton";

export default function ConversationsScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await chatApi.list();
      setConversations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <BackButton />
        <Text style={styles.headerTitle}>Chats</Text>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(true); }}
            tintColor="#16a34a"
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptySub}>
              {user?.role === "client"
                ? "Open a worker's profile and tap Message to start a conversation."
                : "Clients will reach out to you here."}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <ConversationRow
            conversation={item}
            myId={user?.id ?? ""}
            onPress={() => router.push(`/chat/${item.id}`)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

function ConversationRow({
  conversation,
  myId,
  onPress,
}: {
  conversation: Conversation;
  myId: string;
  onPress: () => void;
}) {
  const isClient = conversation.client.id === myId;
  const other = isClient ? conversation.worker : conversation.client;
  const otherProfile = isClient
    ? conversation.worker.workerProfile
    : conversation.client.clientProfile;
  const name = otherProfile?.name ?? "Unknown";
  const pic = otherProfile?.profilePicture;
  const lastMsg = conversation.messages?.[0];
  const lastTime = lastMsg?.createdAt ?? conversation.createdAt;

  function getColor(n: string) {
    const colors = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
    return colors[n.charCodeAt(0) % colors.length];
  }

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.avatar, { backgroundColor: getColor(name) }]}>
        {pic ? (
          <Image source={{ uri: pic }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
        )}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.time}>{timeAgo(lastTime)}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {lastMsg
            ? (lastMsg.senderId === myId ? "You: " : "") + lastMsg.content
            : "No messages yet"}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
  },
  empty: { alignItems: "center", padding: 48, gap: 8 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#374151" },
  emptySub: { fontSize: 14, color: "#9ca3af", textAlign: "center", lineHeight: 20 },
  separator: { height: 1, backgroundColor: "#f3f4f6", marginLeft: 78 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 50, height: 50, borderRadius: 25 },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 18 },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  name: { fontSize: 15, fontWeight: "600", color: "#111827", flex: 1 },
  time: { fontSize: 11, color: "#9ca3af", marginLeft: 8 },
  preview: { fontSize: 13, color: "#6b7280" },
});
