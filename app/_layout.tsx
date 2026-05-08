import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { I18nextProvider } from "react-i18next";
import { useFonts } from "expo-font";
import { NotoNastaliqUrdu_400Regular } from "@expo-google-fonts/noto-nastaliq-urdu";
import { useAuthStore } from "@/store/authStore";
import { initI18n } from "@/i18n";
import i18n from "@/i18n";

// Side-effect import — augments i18next types with translation keys
import "@/i18n/types";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  // Load Urdu font alongside everything else
  const [fontsLoaded] = useFonts({
    NotoNastaliqUrdu: NotoNastaliqUrdu_400Regular,
  });

  useEffect(() => {
    // Run auth restore + i18n init in parallel — neither blocks the other
    Promise.all([loadFromStorage(), initI18n()]).finally(() => setReady(true));
  }, []);

  if (!ready || !fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f9fafb",
        }}
      >
        <ActivityIndicator color="#16a34a" size="large" />
      </View>
    );
  }

  return (
    <I18nextProvider i18n={i18n}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="auth"
          options={{ title: "Sign In", presentation: "modal" }}
        />
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
  );
}
