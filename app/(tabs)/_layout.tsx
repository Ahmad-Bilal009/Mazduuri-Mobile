import { Tabs } from "expo-router";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useAuthStore } from "@/store/authStore";
import { useAppTranslation } from "@/hooks/useAppTranslation";

function TabIcon({
  focused,
  color,
  activeIcon,
  inactiveIcon,
}: {
  focused: boolean;
  color: string;
  activeIcon: string;
  inactiveIcon: string;
}) {
  return (
    <MaterialCommunityIcons
      name={focused ? activeIcon : inactiveIcon}
      size={24}
      color={color}
    />
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
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} activeIcon="home" inactiveIcon="home-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="workers"
        options={{
          title: t("nav.workers"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} activeIcon="account-hard-hat" inactiveIcon="account-hard-hat" />
          ),
          href: isWorker ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t("nav.jobs"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} activeIcon="briefcase" inactiveIcon="briefcase-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chats",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} activeIcon="chat" inactiveIcon="chat-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav.profile"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} activeIcon="account-circle" inactiveIcon="account-circle-outline" />
          ),
        }}
      />
    </Tabs>
  );
}
