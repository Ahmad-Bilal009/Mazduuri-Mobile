import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Linking,
  Alert,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  useAudioPlayerStatus,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from "expo-audio";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { chatApi, uploadImage, uploadAudio } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { setActiveConversation } from "@/lib/push";
import type { Conversation, Message } from "@/types";

const POLL_MS = 4000;

// WhatsApp-style palette
const WALLPAPER = "#ece5dd";
const BUBBLE_MINE = "#d9fdd3";
const TICK_READ = "#53bdeb";

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const listRef = useRef<FlatList<Message>>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const latestTs = useRef<string | null>(null);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 1000);

  // ─── Data loading ───────────────────────────────────────────────────────────

  const loadConversation = useCallback(async () => {
    try {
      const convs = await chatApi.list();
      const found = convs.find((c) => c.id === id);
      if (found) setConversation(found);
    } catch {}
  }, [id]);

  const loadMessages = useCallback(async () => {
    try {
      const data = await chatApi.getMessages(id);
      setMessages(data);
      if (data.length) latestTs.current = data[data.length - 1].createdAt;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 100);
    } catch {}
    finally { setLoading(false); }
  }, [id]);

  const pollMessages = useCallback(async () => {
    try {
      const data = await chatApi.getMessages(id);
      if (!data.length) return;
      const newest = data[data.length - 1].createdAt;
      if (newest !== latestTs.current) {
        setMessages(data);
        latestTs.current = newest;
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        chatApi.markRead(id).catch(() => {});
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    loadConversation();
    loadMessages().then(() => { chatApi.markRead(id).catch(() => {}); });
  }, [id]);

  // Suppress push banners for the thread already on screen.
  useEffect(() => {
    setActiveConversation(id);
    return () => setActiveConversation(null);
  }, [id]);

  useEffect(() => {
    pollRef.current = setInterval(pollMessages, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollMessages]);

  // ─── Send helpers ───────────────────────────────────────────────────────────

  function optimisticAdd(msg: Message) {
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }

  async function handleSendText() {
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setDraft("");
    try {
      const msg = await chatApi.send(id, { content });
      optimisticAdd(msg);
      latestTs.current = msg.createdAt;
    } catch {
      setDraft(content);
    } finally { setSending(false); }
  }

  async function handleSendImage(fromCamera: boolean) {
    setShowAttach(false);
    const permFn = fromCamera
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { status } = await permFn();
    if (status !== "granted") {
      Alert.alert("Permission needed", fromCamera
        ? "Allow camera access to take photos."
        : "Allow photo library access to send images.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled) return;
    setAttachLoading(true);
    try {
      const url = await uploadImage(result.assets[0].uri, "jobs");
      const msg = await chatApi.send(id, { type: "image", mediaUrl: url });
      optimisticAdd(msg);
      latestTs.current = msg.createdAt;
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to send image");
    } finally { setAttachLoading(false); }
  }

  async function handleSendLocation() {
    setShowAttach(false);
    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        Alert.alert(
          "Location Off",
          "Location services are disabled. Please turn them on in your device settings.",
        );
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow location access to share your location.");
        return;
      }
      setAttachLoading(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(loc.coords).catch(() => [null]);
      const label = place
        ? [place.name, place.district, place.city].filter(Boolean).join(", ")
        : `${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`;
      const msg = await chatApi.send(id, {
        type: "location",
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        locationLabel: label,
      });
      optimisticAdd(msg);
      latestTs.current = msg.createdAt;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      const isServiceErr = /unavailable|location|disabled/i.test(msg);
      Alert.alert(
        "Location error",
        isServiceErr
          ? "Could not get your location. Make sure location services are enabled."
          : (msg || "Could not get location"),
      );
    } finally {
      setAttachLoading(false);
    }
  }

  // ─── Voice recording ────────────────────────────────────────────────────────

  async function startRecording() {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission needed", "Allow microphone access to send voice messages.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not start recording");
    }
  }

  async function stopRecording() {
    if (!isRecording) return;
    try {
      await audioRecorder.stop();
      setIsRecording(false);
      const uri = audioRecorder.uri;
      if (!uri) return;
      const durationMs = recorderState.durationMillis;
      if (durationMs < 1000) return; // discard clips under 1 second
      setAttachLoading(true);
      const url = await uploadAudio(uri);
      const msg = await chatApi.send(id, { type: "voice", mediaUrl: url });
      optimisticAdd(msg);
      latestTs.current = msg.createdAt;
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to send voice message");
      setIsRecording(false);
    } finally { setAttachLoading(false); }
  }

  // ─── UI helpers ─────────────────────────────────────────────────────────────

  const isClient = user?.id === conversation?.client.id;
  const otherUser = conversation ? (isClient ? conversation.worker : conversation.client) : null;
  const other = conversation
    ? isClient ? conversation.worker.workerProfile : conversation.client.clientProfile
    : null;
  const otherName = other?.name ?? "…";
  const otherPic = other?.profilePicture;
  const otherPhone = otherUser?.phone;

  function handleMenu() {
    const options: { text: string; onPress?: () => void; style?: "cancel" }[] = [];
    if (otherPhone) {
      options.push({ text: "Call", onPress: () => Linking.openURL(`tel:${otherPhone}`) });
      options.push({
        text: "WhatsApp",
        onPress: () => Linking.openURL(`https://wa.me/${otherPhone.replace(/\D/g, "")}`),
      });
    }
    if (isClient && conversation?.worker.id) {
      options.push({
        text: "View Profile",
        onPress: () => router.push(`/workers/${conversation.worker.id}`),
      });
    }
    options.push({ text: "Cancel", style: "cancel" });
    Alert.alert(otherName, undefined, options);
  }

  const fmtMs = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  function dateLabel(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString("en-PK", { weekday: "short", month: "short", day: "numeric" });
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBack}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>

        <View style={[styles.headerAvatar, { backgroundColor: getColor(otherName) }]}>
          {otherPic
            ? <Image source={{ uri: otherPic }} style={styles.headerAvatarImg} />
            : <Text style={styles.headerAvatarText}>{otherName[0]?.toUpperCase()}</Text>}
        </View>

        <View style={styles.headerNameWrap}>
          <Text style={styles.headerName} numberOfLines={1}>{otherName}</Text>
        </View>

        {otherPhone ? (
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => Linking.openURL(`tel:${otherPhone}`)}
            hitSlop={6}
          >
            <MaterialCommunityIcons name="phone-outline" size={22} color="#111827" />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.headerIconBtn} onPress={handleMenu} hitSlop={6}>
          <MaterialCommunityIcons name="dots-vertical" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={{ flex: 1 }} onPress={() => setShowAttach(false)}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messageList}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <View style={styles.emptyChatPill}>
                  <Text style={styles.emptyChatText}>No messages yet. Say hello!</Text>
                </View>
              </View>
            }
            renderItem={({ item, index }) => {
              const isMine = item.senderId === user?.id;
              const prev = messages[index - 1];
              const showDate = !prev ||
                new Date(item.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();
              const showAvatar = !isMine && (!prev || prev.senderId !== item.senderId || showDate);
              return (
                <>
                  {showDate && (
                    <View style={styles.dateSepWrap}>
                      <Text style={styles.dateSep}>{dateLabel(item.createdAt)}</Text>
                    </View>
                  )}
                  <MessageRow
                    message={item}
                    isMine={isMine}
                    showAvatar={showAvatar}
                    avatarUri={otherPic}
                    avatarName={otherName}
                  />
                </>
              );
            }}
          />
        </Pressable>

        {/* ── Attach panel ── */}
        {showAttach && (
          <View style={styles.attachPanel}>
            <AttachOption
              icon="camera"
              label="Camera"
              color="#ec4899"
              onPress={() => handleSendImage(true)}
            />
            <AttachOption
              icon="image"
              label="Gallery"
              color="#8b5cf6"
              onPress={() => handleSendImage(false)}
            />
            <AttachOption
              icon="map-marker"
              label="Location"
              color="#16a34a"
              onPress={handleSendLocation}
            />
          </View>
        )}

        {/* ── Input bar ── */}
        <View style={styles.inputBar}>
          {isRecording ? (
            <>
              <View style={styles.recordingIndicator}>
                <View style={styles.recordingDot} />
                <Text style={styles.recordingLabel}>Recording…</Text>
                <Text style={styles.recordingTimer}>{fmtMs(recorderState.durationMillis)}</Text>
              </View>
              <Pressable style={styles.sendCircle} onPress={stopRecording}>
                <MaterialCommunityIcons name="stop" size={20} color="#fff" />
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.inputPill}>
                <TouchableOpacity
                  onPress={() => setShowAttach((v) => !v)}
                  disabled={attachLoading || sending}
                  hitSlop={6}
                  style={styles.attachBtn}
                >
                  {attachLoading
                    ? <ActivityIndicator color="#6b7280" size="small" />
                    : <MaterialCommunityIcons name="paperclip" size={22} color="#6b7280" />}
                </TouchableOpacity>

                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={(t) => { setDraft(t); if (showAttach) setShowAttach(false); }}
                  placeholder="Message…"
                  placeholderTextColor="#9ca3af"
                  multiline
                  maxLength={1000}
                  returnKeyType="send"
                  onSubmitEditing={handleSendText}
                />

                {!draft.trim() && (
                  <Pressable
                    onPressIn={startRecording}
                    onPressOut={stopRecording}
                    disabled={attachLoading || sending}
                    hitSlop={6}
                    style={styles.micBtn}
                  >
                    <MaterialCommunityIcons name="microphone" size={22} color="#6b7280" />
                  </Pressable>
                )}
              </View>

              <TouchableOpacity
                style={[styles.sendCircle, (sending || !draft.trim()) && !sending && styles.sendCircleIdle]}
                onPress={handleSendText}
                disabled={sending || !draft.trim()}
              >
                {sending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <MaterialCommunityIcons name="send" size={19} color="#fff" />}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Attach option ────────────────────────────────────────────────────────────

function AttachOption({
  icon, label, color, onPress,
}: { icon: string; label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.attachOption} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.attachOptionCircle, { backgroundColor: color }]}>
        <MaterialCommunityIcons name={icon} size={24} color="#fff" />
      </View>
      <Text style={styles.attachOptionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Message row (avatar + bubble) ────────────────────────────────────────────

function MessageRow({
  message, isMine, showAvatar, avatarUri, avatarName,
}: {
  message: Message;
  isMine: boolean;
  showAvatar: boolean;
  avatarUri?: string;
  avatarName: string;
}) {
  if (isMine) {
    return (
      <View style={styles.rowMine}>
        <MessageBubble message={message} isMine />
      </View>
    );
  }
  return (
    <View style={styles.rowOther}>
      <View style={styles.rowAvatarSlot}>
        {showAvatar && (
          avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.rowAvatar} />
          ) : (
            <View style={[styles.rowAvatar, { backgroundColor: getColor(avatarName), alignItems: "center", justifyContent: "center" }]}>
              <Text style={styles.rowAvatarText}>{avatarName[0]?.toUpperCase()}</Text>
            </View>
          )
        )}
      </View>
      <MessageBubble message={message} isMine={false} />
    </View>
  );
}

// ─── Ticks (sent / read) ──────────────────────────────────────────────────────

function Ticks({ message }: { message: Message }) {
  return (
    <MaterialCommunityIcons
      name={message.readAt ? "check-all" : "check"}
      size={14}
      color={message.readAt ? TICK_READ : "#9ca3af"}
      style={{ marginLeft: 2 }}
    />
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const timeStr = new Date(message.createdAt).toLocaleTimeString("en-PK", {
    hour: "2-digit", minute: "2-digit",
  });

  const footer = (
    <View style={styles.bubbleFooter}>
      <Text style={styles.bubbleTime}>{timeStr}</Text>
      {isMine && <Ticks message={message} />}
    </View>
  );

  if (message.type === "image" && message.mediaUrl) {
    return (
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, styles.imageBubble]}>
        <Image source={{ uri: message.mediaUrl }} style={styles.msgImage} resizeMode="cover" />
        {message.content ? (
          <Text style={[styles.bubbleText, { marginTop: 4, paddingHorizontal: 6 }]}>
            {message.content}
          </Text>
        ) : null}
        <View style={styles.imageFooterOverlay}>
          <Text style={styles.imageTime}>{timeStr}</Text>
          {isMine && (
            <MaterialCommunityIcons
              name={message.readAt ? "check-all" : "check"}
              size={14}
              color={message.readAt ? TICK_READ : "rgba(255,255,255,0.9)"}
              style={{ marginLeft: 2 }}
            />
          )}
        </View>
      </View>
    );
  }

  if (message.type === "location") {
    return (
      <TouchableOpacity
        style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, styles.locationBubble]}
        onPress={() => Linking.openURL(`https://maps.google.com/?q=${message.latitude},${message.longitude}`)}
        activeOpacity={0.8}
      >
        <View style={styles.locationIconWrap}>
          <MaterialCommunityIcons name="map-marker" size={24} color="#16a34a" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.locationLabel} numberOfLines={2}>
            {message.locationLabel ?? `${message.latitude?.toFixed(4)}, ${message.longitude?.toFixed(4)}`}
          </Text>
          <Text style={styles.locationTap}>Tap to open in Maps</Text>
        </View>
        {footer}
      </TouchableOpacity>
    );
  }

  if (message.type === "voice" && message.mediaUrl) {
    return <VoiceBubble message={message} isMine={isMine} timeStr={timeStr} />;
  }

  return (
    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
      <Text style={styles.bubbleText}>{message.content}</Text>
      {footer}
    </View>
  );
}

// ─── Voice bubble ─────────────────────────────────────────────────────────────

function VoiceBubble({
  message, isMine, timeStr,
}: { message: Message; isMine: boolean; timeStr: string }) {
  const player = useAudioPlayer(message.mediaUrl ?? null);
  const status = useAudioPlayerStatus(player);

  const barHeights = useMemo(() =>
    Array.from({ length: 28 }, (_, i) => 4 + Math.abs(Math.sin(i * 0.75 + 1.2)) * 18),
    [],
  );

  async function togglePlay() {
    try {
      if (status.playing) {
        player.pause();
      } else {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        player.play();
      }
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Could not play audio");
    }
  }

  const progress = status.duration > 0 ? status.currentTime / status.duration : 0;
  const fmtSec = (s: number) =>
    `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const displayTime = status.duration > 0
    ? fmtSec(status.playing || status.currentTime > 0 ? status.currentTime : status.duration)
    : "";

  return (
    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther, styles.voiceBubble]}>
      <View style={styles.voiceRow}>
        <TouchableOpacity onPress={togglePlay} style={styles.voicePlayBtn}>
          <MaterialCommunityIcons
            name={status.playing ? "pause" : "play"}
            size={22}
            color="#fff"
          />
        </TouchableOpacity>

        <View style={styles.waveform}>
          {barHeights.map((h, i) => (
            <View
              key={i}
              style={[
                styles.waveBar,
                { height: h },
                { backgroundColor: i / barHeights.length <= progress ? "#16a34a" : "#b7c8b3" },
              ]}
            />
          ))}
        </View>

        <Text style={styles.voiceDuration}>{displayTime}</Text>
      </View>

      <View style={styles.bubbleFooter}>
        <Text style={styles.bubbleTime}>{timeStr}</Text>
        {isMine && <Ticks message={message} />}
      </View>
    </View>
  );
}

function getColor(n: string) {
  const palette = ["#16a34a", "#2563eb", "#9333ea", "#ea580c", "#0d9488"];
  return palette[n.charCodeAt(0) % palette.length];
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WALLPAPER },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: WALLPAPER },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 8,
  },
  headerBack: { padding: 4 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  headerAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  headerNameWrap: { flex: 1 },
  headerName: { fontSize: 16.5, fontWeight: "700", color: "#111827" },
  headerIconBtn: { padding: 6 },

  // Message list
  messageList: { padding: 12, paddingBottom: 8 },
  emptyChat: { flex: 1, alignItems: "center", padding: 40 },
  emptyChatPill: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyChatText: { fontSize: 13.5, color: "#6b7280" },
  dateSepWrap: { alignItems: "center", marginVertical: 10 },
  dateSep: {
    fontSize: 12,
    color: "#6b7280",
    fontWeight: "500",
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: "hidden",
  },

  // Rows
  rowMine: { alignItems: "flex-end", marginVertical: 2 },
  rowOther: { flexDirection: "row", alignItems: "flex-end", marginVertical: 2, gap: 6 },
  rowAvatarSlot: { width: 30 },
  rowAvatar: { width: 30, height: 30, borderRadius: 15 },
  rowAvatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  // Bubbles
  bubble: {
    maxWidth: "76%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
    elevation: 1,
  },
  bubbleMine: { backgroundColor: BUBBLE_MINE, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#fff", borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, color: "#111827", lineHeight: 21 },
  bubbleFooter: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    marginTop: 2,
  },
  bubbleTime: { fontSize: 10.5, color: "#6b7280" },

  // Image message
  imageBubble: { padding: 4, borderRadius: 14 },
  msgImage: { width: 230, height: 190, borderRadius: 11 },
  imageFooterOverlay: {
    position: "absolute",
    bottom: 10,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  imageTime: { fontSize: 10.5, color: "#fff" },

  // Location message
  locationBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    minWidth: 220,
  },
  locationIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  locationLabel: { fontSize: 13.5, fontWeight: "600", color: "#111827", lineHeight: 18 },
  locationTap: { fontSize: 11, color: "#6b7280", marginTop: 2 },

  // Voice message
  voiceBubble: { minWidth: 230, paddingVertical: 8 },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  voicePlayBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  waveform: { flex: 1, flexDirection: "row", alignItems: "center", gap: 2, height: 30 },
  waveBar: { width: 3, borderRadius: 2 },
  voiceDuration: { fontSize: 11, color: "#6b7280", minWidth: 30, textAlign: "right" },

  // Attach panel
  attachPanel: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 18,
    marginHorizontal: 8,
  },
  attachOption: { alignItems: "center", gap: 6 },
  attachOptionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  attachOptionLabel: { fontSize: 12.5, color: "#374151", fontWeight: "500" },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
  },
  inputPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 6,
    minHeight: 46,
  },
  attachBtn: {
    width: 38,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    fontSize: 15.5,
    color: "#111827",
    maxHeight: 120,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
    paddingHorizontal: 2,
  },
  micBtn: {
    width: 38,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  sendCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  sendCircleIdle: { opacity: 0.55 },

  // Recording
  recordingIndicator: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 16,
    gap: 8,
    height: 46,
  },
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444" },
  recordingLabel: { flex: 1, fontSize: 14, color: "#991b1b", fontWeight: "500" },
  recordingTimer: { fontSize: 14, color: "#991b1b", fontWeight: "600" },
});
