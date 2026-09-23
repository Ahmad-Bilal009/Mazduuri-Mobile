import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { notificationsApi } from "@/lib/api";

/**
 * Push notifications over FCM.
 *
 * The backend talks to FCM directly, so what it needs is the **native FCM
 * registration token** — `getDevicePushTokenAsync()`, not an Expo push token.
 *
 * Android only for now. On iOS that same call returns an APNs token, which
 * FCM v1 cannot target; getting an FCM token there needs the Firebase iOS SDK
 * and a GoogleService-Info.plist. Registration is skipped rather than storing
 * a token the backend could never deliver to.
 */

/** Must match the channel ids the backend sets on each message. */
const CHANNELS: {
  id: string;
  name: string;
  description: string;
}[] = [
  { id: "chat", name: "Messages", description: "New chat messages" },
  { id: "applications", name: "Job activity", description: "Applications and hiring updates" },
  { id: "review", name: "Profile review", description: "Approval and verification updates" },
  { id: "jobs", name: "New jobs", description: "Jobs matching your skills nearby" },
  { id: "default", name: "General", description: "Everything else" },
];

let channelsReady = false;

/**
 * Android drops any notification whose channelId does not exist, so channels
 * must be created before the first message arrives, not on first tap.
 */
async function ensureChannels(): Promise<void> {
  if (channelsReady || Platform.OS !== "android") return;
  channelsReady = true;

  await Promise.all(
    CHANNELS.map((c) =>
      Notifications.setNotificationChannelAsync(c.id, {
        name: c.name,
        description: c.description,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#16a34a",
      }).catch(() => {}),
    ),
  );
}

/**
 * The conversation currently on screen, if any.
 *
 * The server has no presence tracking, so it cannot know the recipient is
 * already reading the thread. Suppressing here is cheap and avoids banners
 * for messages the user is watching arrive.
 */
let activeConversationId: string | null = null;

export function setActiveConversation(id: string | null): void {
  activeConversationId = id;
}

/** Foreground behaviour — without this, notifications are silent while the app is open. */
export function configureForegroundHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as
        | Record<string, unknown>
        | undefined;

      const inThisConversation =
        data?.type === "chat" &&
        typeof data.conversationId === "string" &&
        data.conversationId === activeConversationId;

      return {
        shouldShowBanner: !inThisConversation,
        shouldShowList: !inThisConversation,
        shouldPlaySound: !inThisConversation,
        shouldSetBadge: false,
      };
    },
  });
}

export type PermissionOutcome = "granted" | "denied" | "unsupported";

async function requestPermission(): Promise<PermissionOutcome> {
  // Emulators have no Play Services push transport; asking is pointless.
  if (!Device.isDevice) return "unsupported";

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return "granted";

  // Only ask when we can still be granted — re-asking after a hard denial
  // does nothing on Android 13+ and burns the one prompt on iOS.
  if (!existing.canAskAgain) return "denied";

  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted ? "granted" : "denied";
}

let registeredToken: string | null = null;

/**
 * Asks for permission, gets the FCM token and hands it to the backend.
 * Safe to call on every launch — the backend upserts by token.
 */
export async function registerForPushNotifications(): Promise<PermissionOutcome> {
  try {
    if (Platform.OS !== "android") return "unsupported";

    const outcome = await requestPermission();
    if (outcome !== "granted") return outcome;

    await ensureChannels();

    const { data: token } = await Notifications.getDevicePushTokenAsync();
    if (!token || typeof token !== "string") return "unsupported";

    await notificationsApi.registerToken(token, "android");
    registeredToken = token;
    return "granted";
  } catch {
    // Never let notification setup break app start.
    return "unsupported";
  }
}

/** Detaches this device so a logged-out account stops receiving its pushes. */
export async function unregisterFromPushNotifications(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  await notificationsApi.unregisterToken(token).catch(() => {});
}

// ─── Tap routing ──────────────────────────────────────────────────────────────

export interface NotificationRoute {
  pathname: string;
}

/**
 * Turns a notification's data payload into a route.
 * Returns null when the payload is unrecognised, so an unknown or malformed
 * notification opens the app normally instead of navigating nowhere.
 */
export function routeForNotification(
  data: Record<string, unknown> | undefined,
): NotificationRoute | null {
  if (!data) return null;

  const type = typeof data.type === "string" ? data.type : null;

  if (type === "chat" && typeof data.conversationId === "string") {
    return { pathname: `/chat/${data.conversationId}` };
  }
  if (type === "job" && typeof data.jobId === "string") {
    return { pathname: `/jobs/${data.jobId}` };
  }
  if (type === "review") {
    return { pathname: "/(tabs)/profile" };
  }
  return null;
}
