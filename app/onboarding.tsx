import { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

const SCREEN_W = Dimensions.get("window").width;

interface Slide {
  key: string;
  icon: string;
  accentIcon: string;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    key: "find",
    icon: "account-hard-hat",
    accentIcon: "magnify",
    title: "Find skilled\nworkers near you",
    description: "Connect with verified professionals for all your home and business needs.",
  },
  {
    key: "trust",
    icon: "handshake",
    accentIcon: "shield-check",
    title: "Hire trusted\nprofessionals",
    description: "All workers are verified, rated, and reviewed by real customers.",
  },
  {
    key: "post",
    icon: "briefcase-plus",
    accentIcon: "clock-fast",
    title: "Post jobs\nin seconds",
    description: "Describe your job, add photos, and get offers in no time.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  function finish() {
    router.replace("/welcome");
  }

  function handleNext() {
    if (isLast) {
      finish();
    } else {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar style="dark" />

      {/* Skip */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={finish} hitSlop={10}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
        }
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.illustration}>
              <View style={styles.illustrationCircle}>
                <MaterialCommunityIcons name={item.icon} size={104} color="#16a34a" />
              </View>
              {/* Floating accents */}
              <View style={[styles.accentBadge, styles.accentTopRight]}>
                <MaterialCommunityIcons name="check" size={18} color="#fff" />
              </View>
              <View style={[styles.accentBadge, styles.accentBottomLeft]}>
                <MaterialCommunityIcons name="check" size={14} color="#fff" />
              </View>
              <View style={styles.accentSecondary}>
                <MaterialCommunityIcons name={item.accentIcon} size={22} color="#16a34a" />
              </View>
            </View>

            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((s, i) => (
          <View key={s.key} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {/* Next / Get Started */}
      <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
        <Text style={styles.nextBtnText}>{isLast ? "Get Started" : "Next"}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  topBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  skipText: { fontSize: 15, color: "#6b7280", fontWeight: "500" },

  slide: {
    width: SCREEN_W,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  illustration: {
    width: 250,
    height: 250,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 42,
  },
  illustrationCircle: {
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "#ecfdf3",
    alignItems: "center",
    justifyContent: "center",
  },
  accentBadge: {
    position: "absolute",
    backgroundColor: "#16a34a",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
  },
  accentTopRight: { top: 14, right: 8 },
  accentBottomLeft: { bottom: 26, left: 2, width: 26, height: 26 },
  accentSecondary: {
    position: "absolute",
    bottom: 4,
    right: 30,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    lineHeight: 33,
  },
  description: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 22,
    marginTop: 12,
    maxWidth: 300,
  },

  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
  },
  dotActive: { backgroundColor: "#16a34a" },

  nextBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 14,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 24,
    marginBottom: 12,
  },
  nextBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },
});
