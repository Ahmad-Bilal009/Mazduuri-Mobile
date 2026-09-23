import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/store/authStore";

/**
 * Guests can browse everything but act on nothing. This keeps that boundary
 * in one place so every gated action prompts identically instead of each
 * screen inventing its own redirect.
 */
export function useAuthGate() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const router = useRouter();

  /**
   * Runs `action` when signed in. Otherwise explains what signing in unlocks
   * and offers to go there.
   *
   * @param feature Completes the sentence "Log in to …" — e.g. "apply for
   *                this job". Keep it lowercase and specific.
   * @returns whether the action ran.
   */
  function gate(action: () => void, feature?: string): boolean {
    if (isAuthenticated) {
      action();
      return true;
    }

    Alert.alert(
      "Login required",
      feature
        ? `Log in to ${feature}. Browsing stays free.`
        : "Log in to continue. Browsing stays free.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Log in", onPress: () => router.push("/auth") },
      ],
    );
    return false;
  }

  return { isAuthenticated, gate };
}
