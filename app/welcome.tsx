import { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthStore } from "@/store/authStore";
import { ONBOARDED_KEY } from "@/lib/onboarding";

const FEATURES = [
  { icon: "shield-check", title: "Verified", subtitle: "Trusted\nProfessionals" },
  { icon: "account", title: "All Skills", subtitle: "All Types of\nServices" },
  { icon: "check-circle", title: "Reliable", subtitle: "Quality Work,\nOn Time" },
] as const;

export default function WelcomeScreen() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Mark onboarding as seen so the flow only shows on first launch
  useEffect(() => {
    AsyncStorage.setItem(ONBOARDED_KEY, "1").catch(() => {});
  }, []);

  // Once the auth modal completes, move into the app
  useEffect(() => {
    if (isAuthenticated) router.replace("/(tabs)");
  }, [isAuthenticated]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Logo + tagline */}
        <Image source={require("../assets/icon.png")} style={styles.logo} resizeMode="contain" />
        <View style={styles.taglineRow}>
          <View style={styles.taglineDash} />
          <Text style={styles.tagline}>Kaam Aapka, Bharosa Hamara</Text>
          <View style={styles.taglineDash} />
        </View>

        {/* Feature highlights */}
        <View style={styles.featuresRow}>
          {FEATURES.map((f, i) => (
            <View key={f.title} style={styles.featureItem}>
              {i > 0 && <View style={styles.featureDivider} />}
              <View style={styles.featureBody}>
                <View style={styles.featureIconCircle}>
                  <MaterialCommunityIcons name={f.icon} size={22} color="#16a34a" />
                </View>
                <View>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureSubtitle}>{f.subtitle}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Illustration */}
        <View style={styles.illustration}>
          <View style={styles.illustrationRow}>
            <MaterialCommunityIcons name="account-wrench" size={54} color="#15803d" />
            <MaterialCommunityIcons name="account-hard-hat" size={78} color="#16a34a" />
            <MaterialCommunityIcons name="account-tie" size={54} color="#15803d" />
          </View>
          <View style={styles.illustrationBadge}>
            <MaterialCommunityIcons name="check-decagram" size={24} color="#16a34a" />
          </View>
        </View>

        {/* Title + subtitle */}
        <Text style={styles.title}>
          Welcome to <Text style={styles.titleAccent}>Mazduuri</Text>
        </Text>
        <Text style={styles.subtitle}>
          Pakistan's trusted marketplace for{"\n"}skilled workers and quality service.
        </Text>

        {/* Actions */}
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push("/auth")}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="login" size={21} color="#fff" />
          <Text style={styles.loginBtnText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push("/auth")}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="account-plus" size={21} color="#16a34a" />
          <Text style={styles.createBtnText}>Create Account</Text>
        </TouchableOpacity>

        {/* Guest divider */}
        <View style={styles.guestDividerRow}>
          <View style={styles.guestDividerLine} />
          <Text style={styles.guestDividerText}>or continue as guest</Text>
          <View style={styles.guestDividerLine} />
        </View>

        <TouchableOpacity
          style={styles.guestBtn}
          onPress={() => router.replace("/(tabs)")}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="account" size={19} color="#374151" />
          <Text style={styles.guestBtnText}>Continue as Guest</Text>
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing, you agree to our{"\n"}
          <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
          <Text style={styles.termsLink}>Privacy Policy</Text>.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
  },

  logo: { width: 250, height: 105 },
  taglineRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 },
  taglineDash: { width: 22, height: 1.5, backgroundColor: "#bbf7d0" },
  tagline: { fontSize: 16.5, fontWeight: "700", color: "#111827" },

  // Features
  featuresRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 26,
  },
  featureItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  featureDivider: { width: 1, height: 40, backgroundColor: "#e5e7eb", marginHorizontal: 8 },
  featureBody: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  featureIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ecfdf3",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { fontSize: 13, fontWeight: "700", color: "#16a34a" },
  featureSubtitle: { fontSize: 10.5, color: "#4b5563", lineHeight: 14 },

  // Illustration
  illustration: {
    alignSelf: "stretch",
    height: 170,
    borderRadius: 24,
    backgroundColor: "#ecfdf3",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  illustrationRow: { flexDirection: "row", alignItems: "flex-end", gap: 4 },
  illustrationBadge: {
    position: "absolute",
    top: 14,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  title: { fontSize: 27, fontWeight: "800", color: "#111827", marginTop: 22 },
  titleAccent: { color: "#16a34a" },
  subtitle: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 8,
  },

  // Buttons
  loginBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#16a34a",
    borderRadius: 16,
    height: 54,
    alignSelf: "stretch",
    marginTop: 22,
  },
  loginBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#16a34a",
    borderRadius: 16,
    height: 54,
    alignSelf: "stretch",
    marginTop: 12,
    backgroundColor: "#fff",
  },
  createBtnText: { color: "#16a34a", fontWeight: "700", fontSize: 17 },

  guestDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    alignSelf: "stretch",
    marginTop: 18,
    marginBottom: 12,
  },
  guestDividerLine: { flex: 1, height: 1, backgroundColor: "#e5e7eb" },
  guestDividerText: { fontSize: 12.5, color: "#9ca3af" },

  guestBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 40,
    backgroundColor: "#fff",
  },
  guestBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },

  terms: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 14,
  },
  termsLink: { color: "#16a34a", fontWeight: "600" },
});
