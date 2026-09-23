import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Image, Animated } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

const SPLASH_MS = 1800;

export default function SplashScreen() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      router.replace("/onboarding");
    }, SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Decorative circles */}
      <View style={[styles.circle, styles.circleLg]} />
      <View style={[styles.circle, styles.circleSm]} />

      <Animated.View style={{ alignItems: "center", opacity: fade, transform: [{ scale }] }}>
        <View style={styles.logoCard}>
          <Image source={require("../assets/icon.png")} style={styles.logoImage} resizeMode="contain" />
        </View>
        <Text style={styles.appName}>Mazduuri</Text>
        <Text style={styles.tagline}>Skilled workers, on demand</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  circle: {
    position: "absolute",
    borderRadius: 9999,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  circleLg: { width: 420, height: 420, top: -120, left: -140 },
  circleSm: { width: 300, height: 300, bottom: -80, right: -100 },
  logoCard: {
    width: 132,
    height: 132,
    borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 26,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: { width: 108, height: 108 },
  appName: { fontSize: 38, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  tagline: { fontSize: 15, color: "rgba(255,255,255,0.9)", marginTop: 6 },
});
