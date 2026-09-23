import { useCallback, useEffect, useState } from "react";
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
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { chatApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { timeAgo } from "@/lib/utils";
import type { Conversation } from "@/types";

export default function ChatsTab() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const data = await chatApi.list();
      setConversations(data);
    } catch {
      // ignore network errors silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.tabHeader}>
          <Text style={styles.tabTitle}>Chats</Text>
        </View>
        <View style={styles.center}>
          <MaterialCommunityIcons name="chat-outline" size={56} color="#9ca3af" style={{ marginBottom: 12 }} />
          <Text style={styles.guestTitle}>Login to see messages</Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/auth")}>
            <Text style={styles.loginBtnText}>Login / Sign Up</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.tabHeader}>
        <Text style={styles.tabTitle}>Chats</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#16a34a" />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          style={{ backgroundColor: "#fff" }}
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialCommunityIcons name="chat-outline" size={48} color="#9ca3af" />
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySub}>
                {user?.role === "client"
                  ? "Open a worker's profile and tap Message to start a conversation."
                  : "Clients will reach out to you here once they message you."}
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
      )}
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
  tabHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  tabTitle: { fontSize: 24, fontWeight: "800", color: "#111827" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  guestTitle: { fontSize: 16, fontWeight: "600", color: "#374151", marginBottom: 16 },
  loginBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 19 },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  name: { fontSize: 15, fontWeight: "600", color: "#111827", flex: 1 },
  time: { fontSize: 11, color: "#9ca3af", marginLeft: 8 },
  preview: { fontSize: 13, color: "#6b7280" },
});
