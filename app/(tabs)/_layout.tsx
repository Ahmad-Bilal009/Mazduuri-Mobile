import { Tabs } from "expo-router";
import { Text } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { useAppTranslation } from "@/hooks/useAppTranslation";

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.6 }}>
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  const isWorker = user?.role === "worker";
  const { t } = useAppTranslation();

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.home"),
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="workers"
        options={{
          title: t("nav.workers"),
          tabBarIcon: ({ focused }) => <TabIcon emoji="👷" focused={focused} />,
          href: isWorker ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t("nav.jobs"),
          tabBarIcon: ({ focused }) => <TabIcon emoji="💼" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
