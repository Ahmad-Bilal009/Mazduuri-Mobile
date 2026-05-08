import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

const SKILLS = [
  { emoji: "🏗️", label: "Construction" },
  { emoji: "🔧", label: "Plumbing" },
  { emoji: "⚡", label: "Electrical" },
  { emoji: "🎨", label: "Painting" },
  { emoji: "🪵", label: "Carpentry" },
  { emoji: "🚗", label: "Driving" },
  { emoji: "🧹", label: "Cleaning" },
  { emoji: "🌾", label: "Agriculture" },
];

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>M</Text>
          </View>
          <Text style={styles.appName}>Mazduuri</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>
            Find Skilled Workers{"\n"}Near You
          </Text>
          <Text style={styles.heroSub}>
            Connect directly with daily wage workers. No middleman.
          </Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(tabs)/workers")}
          >
            <Text style={styles.primaryBtnText}>👷 Find Workers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/(tabs)/jobs")}
          >
            <Text style={styles.secondaryBtnText}>💼 Browse Jobs</Text>
          </TouchableOpacity>
        </View>

        {/* Skills Grid */}
        <Text style={styles.sectionTitle}>Browse by Skill</Text>
        <View style={styles.skillGrid}>
          {SKILLS.map((skill) => (
            <TouchableOpacity
              key={skill.label}
              style={styles.skillItem}
              onPress={() => router.push(`/(tabs)/workers`)}
            >
              <Text style={styles.skillEmoji}>{skill.emoji}</Text>
              <Text style={styles.skillLabel}>{skill.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* How it works */}
        <Text style={styles.sectionTitle}>How It Works</Text>
        {[
          {
            icon: "🔍",
            title: "Search Workers",
            desc: "Browse by skill & location",
          },
          {
            icon: "📞",
            title: "Contact Directly",
            desc: "Login to see phone numbers",
          },
          {
            icon: "✅",
            title: "Hire & Pay",
            desc: "Agree & pay directly — no fees",
          },
        ].map((step) => (
          <View key={step.title} style={styles.stepCard}>
            <View style={styles.stepIcon}>
              <Text style={{ fontSize: 20 }}>{step.icon}</Text>
            </View>
            <View>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}

        {/* CTA */}
        <View style={styles.cta}>
          <Text style={styles.ctaTitle}>Are You a Worker?</Text>
          <Text style={styles.ctaDesc}>
            Create a free profile and get hired today
          </Text>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.ctaBtnText}>Create Worker Profile →</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  scroll: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    paddingTop: 12,
  },
  logo: {
    width: 32,
    height: 32,
    backgroundColor: "#16a34a",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  appName: { fontSize: 20, fontWeight: "700", color: "#111827" },
  hero: {
    backgroundColor: "#fff",
    margin: 16,
    marginTop: 4,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 34,
    marginBottom: 8,
  },
  heroSub: { fontSize: 14, color: "#6b7280", marginBottom: 20, lineHeight: 20 },
  primaryBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    backgroundColor: "#f9fafb",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  secondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
  },
  skillGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
  },
  skillItem: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f3f4f6",
    width: "22%",
    minWidth: 70,
  },
  skillEmoji: { fontSize: 22, marginBottom: 4 },
  skillLabel: {
    fontSize: 10,
    color: "#4b5563",
    fontWeight: "500",
    textAlign: "center",
  },
  stepCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f3f4f6",
    alignItems: "center",
  },
  stepIcon: {
    width: 40,
    height: 40,
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  stepDesc: { fontSize: 12, color: "#6b7280", marginTop: 1 },
  cta: {
    backgroundColor: "#16a34a",
    margin: 16,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  ctaTitle: { fontSize: 20, fontWeight: "700", color: "#fff", marginBottom: 6 },
  ctaDesc: {
    fontSize: 13,
    color: "#bbf7d0",
    marginBottom: 16,
    textAlign: "center",
  },
  ctaBtn: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  ctaBtnText: { color: "#16a34a", fontWeight: "700", fontSize: 14 },
});
