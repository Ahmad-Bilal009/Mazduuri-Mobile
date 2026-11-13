import { View, StyleSheet, Platform } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useAuthStore } from "@/store/authStore";
import { useAppTranslation } from "@/hooks/useAppTranslation";

const ACTIVE = "#16a34a";
const INACTIVE = "#94a3b8";

/**
 * Outline glyph at rest, filled glyph on a soft green pill when selected —
 * the selected tab reads at a glance without relying on colour alone.
 */
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
    <View style={[styles.pill, focused && styles.pillActive]}>
      <MaterialCommunityIcons name={focused ? activeIcon : inactiveIcon} size={27} color={color} />
    </View>
  );
}

export default function TabsLayout() {
  const user = useAuthStore((s) => s.user);
  const isWorker = user?.role === "worker";
  const { t } = useAppTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        // Taller than the platform default; the safe-area inset is added on
        // top so the home indicator never overlaps the labels.
        tabBarStyle: [styles.bar, { height: 70 + insets.bottom, paddingBottom: insets.bottom + 6 }],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav.home"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} activeIcon="home-variant" inactiveIcon="home-variant-outline" />
          ),
        }}
      />
      <Tabs.Screen
        name="workers"
        options={{
          title: t("nav.workers"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} activeIcon="account-search" inactiveIcon="account-search-outline" />
          ),
          href: isWorker ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t("nav.jobs"),
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              focused={focused}
              color={color}
              activeIcon="briefcase-variant"
              inactiveIcon="briefcase-variant-outline"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "Chats",
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused} color={color} activeIcon="message-text" inactiveIcon="message-text-outline" />
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

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#fff",
    borderTopColor: "#eef2f6",
    borderTopWidth: 1,
    paddingTop: 8,
    ...Platform.select({
      ios: { shadowColor: "#0f172a", shadowOpacity: 0.04, shadowRadius: 10, shadowOffset: { width: 0, height: -2 } },
      android: { elevation: 8 },
    }),
  },
  item: { paddingTop: 2 },
  label: { fontSize: 12.5, fontWeight: "700", marginTop: 5 },
  pill: {
    width: 62,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pillActive: { backgroundColor: "#dcfce7" },
});
