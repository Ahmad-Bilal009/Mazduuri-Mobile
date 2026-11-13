import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Animated, Easing } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";

/** Same width as `imageWidth` for expo-splash-screen in app.json, so the hand-off is seamless. */
export const SPLASH_LOGO_WIDTH = 240;
const LOGO_RATIO = 508 / 1260; // assets/logo-wordmark.png

/** Long enough to read the brand, short enough not to feel like a wait. */
const MIN_VISIBLE_MS = 1600;

/**
 * Animated launch screen shown over the app while it boots.
 *
 * The native splash (white + logo) stays up until this has laid out, then this
 * takes over with the logo in the identical spot, so there is no flash. It
 * fades away once the app is ready and the minimum time has passed.
 */
export function AppSplash({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const [minElapsed, setMinElapsed] = useState(false);

  const logoScale = useRef(new Animated.Value(1)).current;
  const content = useRef(new Animated.Value(0)).current; // tagline + footer
  const progress = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(logoScale, { toValue: 1.04, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, friction: 5, useNativeDriver: true }),
      ]),
      Animated.timing(content, { toValue: 1, duration: 600, delay: 250, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
    ).start();

    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || !minElapsed || finished.current) return;
    finished.current = true;
    Animated.timing(exit, { toValue: 0, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
      () => onDone(),
    );
  }, [ready, minElapsed]);

  const barShift = progress.interpolate({ inputRange: [0, 1], outputRange: [-60, 120] });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: exit }]}
      // Only hide the native splash once this view is on screen.
      onLayout={() => {
        SplashScreen.hideAsync().catch(() => {});
      }}
      pointerEvents="none"
    >
      <StatusBar style="dark" />

      <View style={[styles.ring, styles.ringTop]} />
      <View style={[styles.ring, styles.ringBottom]} />

      <View style={styles.center}>
        <Animated.Image
          source={require("../assets/logo-wordmark.png")}
          style={{
            width: SPLASH_LOGO_WIDTH,
            height: SPLASH_LOGO_WIDTH * LOGO_RATIO,
            transform: [{ scale: logoScale }],
          }}
          resizeMode="contain"
        />
        <Animated.View
          style={{
            alignItems: "center",
            opacity: content,
            transform: [{ translateY: content.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
          }}
        >
          <Text style={styles.tagline}>Skilled workers, near you</Text>
          <View style={styles.track}>
            <Animated.View style={[styles.bar, { transform: [{ translateX: barShift }] }]} />
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, { opacity: content }]}>
        <View style={styles.footerRow}>
          <View style={styles.footerDot} />
          <Text style={styles.footerText}>Verified pros across Pakistan</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: "#ffffff", zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  ring: { position: "absolute", borderRadius: 9999, borderColor: "#dcfce7" },
  ringTop: { width: 360, height: 360, top: -170, right: -150, borderWidth: 44 },
  ringBottom: { width: 280, height: 280, bottom: -140, left: -120, borderWidth: 36, borderColor: "#f0fdf4" },
  tagline: { marginTop: 18, fontSize: 15, fontWeight: "600", color: "#64748b", letterSpacing: 0.2 },
  track: {
    marginTop: 26,
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e7f8ec",
    overflow: "hidden",
  },
  bar: { width: 60, height: 4, borderRadius: 2, backgroundColor: "#22c55e" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 48, alignItems: "center" },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  footerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22c55e" },
  footerText: { fontSize: 13, color: "#94a3b8", fontWeight: "500" },
});
