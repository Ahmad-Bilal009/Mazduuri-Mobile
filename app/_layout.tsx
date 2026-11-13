import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider } from "react-i18next";
import { useFonts } from "expo-font";
import { NotoNastaliqUrdu_400Regular } from "@expo-google-fonts/noto-nastaliq-urdu";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "@/store/authStore";
import { useSavedStore } from "@/store/savedStore";
import {
  configureForegroundHandler,
  registerForPushNotifications,
  routeForNotification,
} from "@/lib/push";
import { ONBOARDED_KEY } from "@/lib/onboarding";
import { AppSplash } from "@/components/AppSplash";
import { initI18n } from "@/i18n";
import i18n from "@/i18n";

// Side-effect import — augments i18next types with translation keys
import "@/i18n/types";

// Must run before the first notification arrives, so it lives at module scope
// rather than inside an effect.
configureForegroundHandler();

// Keep the native launch screen up until <AppSplash> has drawn over it.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const needsOnboarding = useRef(false);
  const router = useRouter();
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // A tap that arrives before the router mounts is parked here.
  const pendingRoute = useRef<string | null>(null);

  // Load Urdu font alongside everything else
  const [fontsLoaded] = useFonts({
    NotoNastaliqUrdu: NotoNastaliqUrdu_400Regular,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    MaterialCommunityIcons: require("react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf"),
  });

  useEffect(() => {
    // Run auth restore + i18n init in parallel — neither blocks the other
    Promise.all([
      loadFromStorage(),
      initI18n(),
      AsyncStorage.getItem(ONBOARDED_KEY).catch(() => null),
    ])
      .then(([, , onboarded]) => {
        if (!onboarded && !useAuthStore.getState().isAuthenticated) {
          needsOnboarding.current = true;
        }
      })
      .catch(() => {})
      .finally(() => {
        // Restore saved hearts for a returning session before the first render
        // of any worker list.
        if (useAuthStore.getState().isAuthenticated) {
          void useSavedStore.getState().hydrate();
        }
        setReady(true);
      });
  }, []);

  // Where to land once booted (this happens under the splash, so the first
  // screen the user sees is already the right one):
  //   signed in            → tabs (the default route)
  //   signed out, new user → onboarding → login
  //   signed out           → login
  useEffect(() => {
    if (!ready || !fontsLoaded) return;
    if (useAuthStore.getState().isAuthenticated) return;
    router.replace(needsOnboarding.current ? "/onboarding" : "/auth");
    needsOnboarding.current = false;
  }, [ready, fontsLoaded]);

  // Register for push once signed in, and drop the token on sign-out. The
  // token is per-install, so re-registering on every launch is what keeps a
  // rotated one current.
  useEffect(() => {
    if (!isAuthenticated) return;
    void registerForPushNotifications();
  }, [isAuthenticated]);

  // Notification taps. Two sources: a cold start (the app was launched by the
  // tap) and taps while the app is already running.
  useEffect(() => {
    let cancelled = false;

    function go(response: Notifications.NotificationResponse | null) {
      const data = response?.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const route = routeForNotification(data);
      if (!route) return;
      // Park the route until the app has booted; signed-out users land on login.
      if (!ready || !fontsLoaded || !useAuthStore.getState().isAuthenticated) {
        pendingRoute.current = route.pathname;
        return;
      }
      router.push(route.pathname as never);
    }

    Notifications.getLastNotificationResponseAsync()
      .then((r) => {
        if (!cancelled) go(r);
      })
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [ready, fontsLoaded]);

  // Flush a tap that landed before the router was usable.
  useEffect(() => {
    if (!ready || !fontsLoaded || !useAuthStore.getState().isAuthenticated) return;
    const target = pendingRoute.current;
    if (!target) return;
    pendingRoute.current = null;
    router.push(target as never);
  }, [ready, fontsLoaded]);

  const booted = ready && fontsLoaded;

  // One tree throughout, so the splash keeps animating while the app mounts
  // underneath it instead of restarting.
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {booted && (
    <I18nextProvider i18n={i18n}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ animation: "fade", gestureEnabled: false }} />
        <Stack.Screen name="welcome" options={{ animation: "fade", gestureEnabled: false }} />
        {/* A full screen, not a modal: after the splash it is the first
            screen, and a modal with nothing beneath it renders on black. */}
        <Stack.Screen name="auth" options={{ animation: "slide_from_bottom" }} />
        <Stack.Screen
          name="language-select"
          options={{
            title: "Language",
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen name="workers/[id]" options={{ title: "Worker Profile" }} />
        <Stack.Screen name="jobs/[id]" options={{ title: "Job Details" }} />
      </Stack>
    </I18nextProvider>
      )}
      {!splashDone && <AppSplash ready={booted} onDone={() => setSplashDone(true)} />}
    </View>
  );
}
