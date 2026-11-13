import { signOutFromGoogle } from "@/lib/googleAuth";
import { unregisterFromPushNotifications } from "@/lib/push";
import { useSavedStore } from "@/store/savedStore";
import { useAuthStore } from "@/store/authStore";

/**
 * Clears everything this device holds for the signed-in account. Shared by
 * log out and delete account so the two can never drift apart.
 */
export async function clearLocalSession(): Promise<void> {
  // Drop the cached Google session too, otherwise the next sign-in silently
  // reuses this account instead of offering the picker.
  await signOutFromGoogle().catch(() => {});
  // Detach this device first, or the signed-out account keeps receiving
  // its notifications.
  await unregisterFromPushNotifications().catch(() => {});
  // Saved hearts belong to the account, not the device.
  useSavedStore.getState().clear();
  useAuthStore.getState().clearUser();
}
